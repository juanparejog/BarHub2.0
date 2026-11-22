package com.daw2.barhub.auth.sesion;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/**
 * Reglas de las sesiones con un repositorio en memoria y un reloj que se adelanta a mano.
 * Limite del cliente: 1 hora de inactividad y 12 horas de sesion.
 */
class SesionServiceTest {

    private static final Long USUARIO = 7L;

    private final Map<String, Sesion> guardadas = new HashMap<>();
    private RelojManual reloj;
    private SesionService servicio;

    @BeforeEach
    void preparar() {
        SesionRepository repositorio = mock(SesionRepository.class);
        lenient().when(repositorio.save(any(Sesion.class))).thenAnswer(i -> {
            Sesion s = i.getArgument(0);
            guardadas.put(s.getId(), s);
            return s;
        });
        lenient().when(repositorio.findById(anyString()))
                .thenAnswer(i -> Optional.ofNullable(guardadas.get(i.<String>getArgument(0))));
        lenient().when(repositorio.findByTokenHash(anyString())).thenAnswer(i -> guardadas.values().stream()
                .filter(s -> i.getArgument(0).equals(s.getTokenHash())).findFirst());
        lenient().when(repositorio.findByTokenAnteriorHash(anyString())).thenAnswer(i -> guardadas.values().stream()
                .filter(s -> i.getArgument(0).equals(s.getTokenAnteriorHash())).findFirst());

        reloj = new RelojManual(Instant.parse("2026-11-22T09:00:00Z"));
        servicio = new SesionService(repositorio, new SesionProperties(null, null, null), reloj);
    }

    private SesionService.NuevaSesion abrirCliente() {
        return servicio.abrir(USUARIO, List.of("ROLE_CLIENTE"), "203.0.113.5", "Navegador de pruebas");
    }

    @Test
    void alAbrirSoloSeGuardaElHashDelToken() {
        SesionService.NuevaSesion nueva = abrirCliente();

        Sesion sesion = nueva.sesion();
        assertNotEquals(nueva.tokenRenovacion(), sesion.getTokenHash());
        assertEquals(SesionService.hash(nueva.tokenRenovacion()), sesion.getTokenHash());
        assertEquals(3600, sesion.getInactividadSegundos());
        assertEquals(reloj.instant().plus(Duration.ofHours(12)), sesion.getCaducaEn());
        assertEquals("203.0.113.5", sesion.getIp());
    }

    @Test
    void renovarRotaElTokenYConservaLaCaducidadMaxima() {
        SesionService.NuevaSesion nueva = abrirCliente();
        Instant caducaEn = nueva.sesion().getCaducaEn();
        reloj.avanzar(Duration.ofMinutes(20));

        SesionService.Renovacion renovacion = servicio.renovar(nueva.tokenRenovacion());

        assertNotNull(renovacion.tokenRenovacion());
        assertNotEquals(nueva.tokenRenovacion(), renovacion.tokenRenovacion());
        assertEquals(caducaEn, renovacion.sesion().getCaducaEn());
        assertEquals(reloj.instant(), renovacion.sesion().getUltimaActividad());
    }

    @Test
    void trasElLimiteDeInactividadNoSeRenueva() {
        SesionService.NuevaSesion nueva = abrirCliente();
        reloj.avanzar(Duration.ofMinutes(61));

        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(nueva.tokenRenovacion()));
    }

    @Test
    void trasLaDuracionMaximaNoSeRenuevaAunqueHayaActividad() {
        SesionService.NuevaSesion nueva = abrirCliente();
        String token = nueva.tokenRenovacion();
        for (int i = 0; i < 24; i++) {
            reloj.avanzar(Duration.ofMinutes(30));
            if (i < 23) {
                token = servicio.renovar(token).tokenRenovacion();
            }
        }

        String ultimo = token;
        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(ultimo));
    }

    @Test
    void dosPestanasQueRenuevanALaVezNoCierranLaSesion() {
        SesionService.NuevaSesion nueva = abrirCliente();
        servicio.renovar(nueva.tokenRenovacion());
        reloj.avanzar(Duration.ofSeconds(5));

        SesionService.Renovacion segunda = servicio.renovar(nueva.tokenRenovacion());

        assertNull(segunda.tokenRenovacion(), "dentro del margen no se vuelve a rotar");
        assertNull(segunda.sesion().getRevocadaEn());
    }

    @Test
    void reutilizarUnTokenYaRotadoRevocaLaSesionEntera() {
        SesionService.NuevaSesion nueva = abrirCliente();
        SesionService.Renovacion buena = servicio.renovar(nueva.tokenRenovacion());
        reloj.avanzar(Duration.ofMinutes(2));

        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(nueva.tokenRenovacion()));

        Sesion sesion = guardadas.get(nueva.sesion().getId());
        assertEquals(SesionService.MOTIVO_REUTILIZACION, sesion.getMotivoRevocacion());
        // tampoco vale ya el token que tenia el usuario legitimo
        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(buena.tokenRenovacion()));
    }

    @Test
    void unTokenDesconocidoOVacioNoRenueva() {
        assertThrows(SesionInvalidaException.class, () -> servicio.renovar("inventado"));
        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(null));
        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(" "));
    }

    @Test
    void cerrarRevocaLaSesionYSusTokensDeAcceso() {
        SesionService.NuevaSesion nueva = abrirCliente();
        String id = nueva.sesion().getId();
        assertTrue(servicio.registrarActividad(id, USUARIO));

        servicio.cerrar(nueva.tokenRenovacion());

        assertEquals(SesionService.MOTIVO_CIERRE, guardadas.get(id).getMotivoRevocacion());
        assertFalse(servicio.registrarActividad(id, USUARIO));
        assertThrows(SesionInvalidaException.class, () -> servicio.renovar(nueva.tokenRenovacion()));
    }

    @Test
    void laActividadMantieneVivaLaSesionYSeApuntaComoMuchoCadaMinuto() {
        SesionService.NuevaSesion nueva = abrirCliente();
        String id = nueva.sesion().getId();
        Instant inicio = reloj.instant();

        reloj.avanzar(Duration.ofSeconds(30));
        assertTrue(servicio.registrarActividad(id, USUARIO));
        assertEquals(inicio, guardadas.get(id).getUltimaActividad());

        reloj.avanzar(Duration.ofMinutes(50));
        assertTrue(servicio.registrarActividad(id, USUARIO));
        assertEquals(reloj.instant(), guardadas.get(id).getUltimaActividad());

        // 50 + 50 minutos desde la apertura, pero solo 50 desde la ultima actividad
        reloj.avanzar(Duration.ofMinutes(50));
        assertTrue(servicio.registrarActividad(id, USUARIO));
    }

    @Test
    void elTokenDeAccesoNoSirveConLaSesionDeOtroUsuarioNiSinSesion() {
        SesionService.NuevaSesion nueva = abrirCliente();

        assertFalse(servicio.registrarActividad(nueva.sesion().getId(), 99L));
        assertFalse(servicio.registrarActividad("no-existe", USUARIO));
        assertFalse(servicio.registrarActividad(null, USUARIO));
    }

    /** Reloj fijo que solo avanza cuando el test lo pide. */
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
