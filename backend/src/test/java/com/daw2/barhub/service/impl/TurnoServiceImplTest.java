package com.daw2.barhub.service.impl;

import com.daw2.barhub.auth.sesion.Sesion;
import com.daw2.barhub.auth.sesion.SesionRepository;
import com.daw2.barhub.model.dto.TurnoDto;
import com.daw2.barhub.model.entity.Turno;
import com.daw2.barhub.model.enums.CierreTurno;
import com.daw2.barhub.model.repository.TurnoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/** Registro de jornada con repositorios en memoria y un reloj que se adelanta a mano. */
class TurnoServiceImplTest {

    private static final Long EMPLEADA = 5L;
    private static final List<String> ROLES_EMPLEADO = List.of("ROLE_EMPLEADO");

    private final List<Turno> turnos = new ArrayList<>();
    private final List<Sesion> sesiones = new ArrayList<>();
    private RelojManual reloj;
    private TurnoServiceImpl servicio;

    @BeforeEach
    void preparar() {
        TurnoRepository turnoRepository = mock(TurnoRepository.class);
        lenient().when(turnoRepository.save(any(Turno.class))).thenAnswer(i -> {
            Turno t = i.getArgument(0);
            if (t.getId() == null) {
                t.setId((long) turnos.size() + 1);
                turnos.add(t);
            }
            return t;
        });
        lenient().when(turnoRepository.findFirstByUsuarioIdAndSalidaIsNullOrderByEntradaDesc(any()))
                .thenAnswer(i -> turnos.stream()
                        .filter(t -> t.getUsuarioId().equals(i.getArgument(0)) && t.getSalida() == null)
                        .max(Comparator.comparing(Turno::getEntrada)));
        lenient().when(turnoRepository.findBySalidaIsNull())
                .thenAnswer(i -> turnos.stream().filter(t -> t.getSalida() == null).toList());
        lenient().when(turnoRepository.findByEntradaGreaterThanEqualAndEntradaLessThanOrderByEntradaDesc(any(), any()))
                .thenAnswer(i -> turnos.stream()
                        .filter(t -> !t.getEntrada().isBefore(i.getArgument(0)) && t.getEntrada().isBefore(i.getArgument(1)))
                        .sorted(Comparator.comparing(Turno::getEntrada).reversed())
                        .toList());

        SesionRepository sesionRepository = mock(SesionRepository.class);
        lenient().when(sesionRepository.findByUsuarioIdAndCreadaGreaterThanEqual(any(), any()))
                .thenAnswer(i -> sesiones.stream()
                        .filter(s -> s.getUsuarioId().equals(i.getArgument(0)) && !s.getCreada().isBefore(i.getArgument(1)))
                        .toList());

        reloj = new RelojManual(Instant.parse("2026-11-22T08:00:00Z"));
        servicio = new TurnoServiceImpl(turnoRepository, sesionRepository, reloj);
    }

    /** Sesion de la empleada abierta ahora, con 30 minutos de inactividad y 10 horas de maximo. */
    private Sesion abrirSesion() {
        Sesion s = new Sesion();
        s.setId(UUID.randomUUID().toString());
        s.setUsuarioId(EMPLEADA);
        s.setCreada(reloj.instant());
        s.setUltimaActividad(reloj.instant());
        s.setInactividadSegundos(Duration.ofMinutes(30).toSeconds());
        s.setCaducaEn(reloj.instant().plus(Duration.ofHours(10)));
        sesiones.add(s);
        return s;
    }

    /** Lo que hace el login: primero el turno, despues la sesion. */
    private Sesion iniciarSesion() {
        servicio.abrirSiCorresponde(EMPLEADA, "lucia", ROLES_EMPLEADO);
        return abrirSesion();
    }

    @Test
    void alIniciarSesionUnEmpleadoEmpiezaSuTurno() {
        iniciarSesion();

        TurnoDto turno = servicio.actual(EMPLEADA).orElseThrow();
        assertEquals("lucia", turno.username());
        assertEquals(reloj.instant().toEpochMilli(), turno.entrada());
        assertNull(turno.salida());
    }

    @Test
    void unClienteOUnAdministradorNoFichan() {
        servicio.abrirSiCorresponde(1L, "admin", List.of("ROLE_ADMIN"));
        servicio.abrirSiCorresponde(2L, "cliente", List.of("ROLE_CLIENTE"));
        assertTrue(turnos.isEmpty());
    }

    @Test
    void entrarDesdeOtroDispositivoSigueSiendoElMismoTurno() {
        iniciarSesion();
        reloj.avanzar(Duration.ofMinutes(20));
        iniciarSesion();

        assertEquals(1, turnos.size());
    }

    @Test
    void terminarTurnoRegistraLaSalidaYLaDuracion() {
        iniciarSesion();
        reloj.avanzar(Duration.ofHours(7).plusMinutes(45));

        TurnoDto turno = servicio.terminar(EMPLEADA);

        assertEquals(reloj.instant().toEpochMilli(), turno.salida());
        assertEquals(465, turno.duracionMinutos());
        assertEquals("TERMINADO", turno.cierre());
        assertTrue(servicio.actual(EMPLEADA).isEmpty());
    }

    @Test
    void terminarSinTurnoAbiertoEsUnError() {
        assertThrows(IllegalStateException.class, () -> servicio.terminar(EMPLEADA));
    }

    @Test
    void sinSesionesAbiertasElTurnoSeCierraSoloEnSuUltimaActividad() {
        Sesion sesion = iniciarSesion();
        reloj.avanzar(Duration.ofHours(3));
        sesion.setUltimaActividad(reloj.instant());
        Instant ultimaActividad = reloj.instant();
        reloj.avanzar(Duration.ofMinutes(31));

        servicio.cerrarTurnosSinSesion();

        Turno turno = turnos.get(0);
        assertEquals(ultimaActividad, turno.getSalida());
        assertEquals(CierreTurno.AUTOMATICO, turno.getCierre());
    }

    @Test
    void siCerroSesionLaSalidaEsLaHoraDelCierre() {
        Sesion sesion = iniciarSesion();
        reloj.avanzar(Duration.ofHours(2));
        sesion.setRevocadaEn(reloj.instant());
        Instant cierre = reloj.instant();
        reloj.avanzar(Duration.ofMinutes(5));

        servicio.cerrarTurnosSinSesion();

        assertEquals(cierre, turnos.get(0).getSalida());
    }

    @Test
    void conUnaSesionAbiertaElTurnoNoSeCierra() {
        iniciarSesion();
        reloj.avanzar(Duration.ofMinutes(10));

        servicio.cerrarTurnosSinSesion();

        assertNull(turnos.get(0).getSalida());
    }

    @Test
    void unTurnoViejoSinSesionSeCierraAlVolverAEntrarYEmpiezaOtro() {
        iniciarSesion();
        reloj.avanzar(Duration.ofHours(14));

        iniciarSesion();

        assertEquals(2, turnos.size());
        assertEquals(CierreTurno.AUTOMATICO, turnos.get(0).getCierre());
        assertNull(turnos.get(1).getSalida());
    }

    @Test
    void elListadoVaPorDiasEnHoraDeMadridDelMasRecienteAlMasAntiguo() {
        iniciarSesion();
        servicio.terminar(EMPLEADA);
        reloj.avanzar(Duration.ofDays(1));
        iniciarSesion();

        List<TurnoDto> hoyYAyer = servicio.listar(LocalDate.of(2026, 11, 22), LocalDate.of(2026, 11, 23));
        assertEquals(2, hoyYAyer.size());
        assertTrue(hoyYAyer.get(0).entrada() > hoyYAyer.get(1).entrada());
        assertEquals(1, servicio.listar(LocalDate.of(2026, 11, 23), LocalDate.of(2026, 11, 23)).size());
        assertEquals(0, servicio.listar(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 21)).size());
    }

    @Test
    void elTurnoRecienEmpezadoLlevaCeroMinutos() {
        iniciarSesion();
        Optional<TurnoDto> actual = servicio.actual(EMPLEADA);
        assertTrue(actual.isPresent());
        assertEquals(0, actual.get().duracionMinutos());
    }

    private static final class RelojManual extends Clock {
        private Instant ahora;

        RelojManual(Instant inicio) {
            this.ahora = inicio;
        }

        void avanzar(Duration tiempo) {
            ahora = ahora.plus(tiempo);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zona) {
            return this;
        }

        @Override
        public Instant instant() {
            return ahora;
        }
    }
}
