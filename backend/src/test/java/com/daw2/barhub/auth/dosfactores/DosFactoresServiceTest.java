package com.daw2.barhub.auth.dosfactores;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/** Reglas de la verificacion en dos pasos con repositorios en memoria y un reloj que se adelanta a mano. */
class DosFactoresServiceTest {

    private static final Long USUARIO = 7L;

    private final Map<Long, SegundoFactor> factores = new HashMap<>();
    private final List<CodigoRecuperacion> codigos = new ArrayList<>();
    private SegundoFactorRepository repoFactores;
    private CodigoRecuperacionRepository repoCodigos;
    private RelojManual reloj;
    private DosFactoresService servicio;

    @BeforeEach
    void preparar() {
        repoFactores = mock(SegundoFactorRepository.class);
        lenient().when(repoFactores.findByUsuarioId(anyLong()))
                .thenAnswer(i -> Optional.ofNullable(factores.get(i.<Long>getArgument(0))));
        lenient().when(repoFactores.save(any(SegundoFactor.class))).thenAnswer(i -> {
            SegundoFactor s = i.getArgument(0);
            if (s.getId() == null) {
                s.setId(100L + factores.size());
            }
            factores.put(s.getUsuarioId(), s);
            return s;
        });
        lenient().when(repoFactores.marcarPaso(anyLong(), anyLong())).thenAnswer(i -> {
            Long id = i.getArgument(0);
            long paso = i.getArgument(1);
            for (SegundoFactor s : factores.values()) {
                if (s.getId().equals(id) && (s.getUltimoPaso() == null || s.getUltimoPaso() < paso)) {
                    s.setUltimoPaso(paso);
                    return 1;
                }
            }
            return 0;
        });

        repoCodigos = mock(CodigoRecuperacionRepository.class);
        lenient().when(repoCodigos.save(any(CodigoRecuperacion.class))).thenAnswer(i -> {
            CodigoRecuperacion c = i.getArgument(0);
            c.setId((long) codigos.size() + 1);
            codigos.add(c);
            return c;
        });
        lenient().when(repoCodigos.findFirstByUsuarioIdAndHuellaAndUsadoEnIsNull(anyLong(), anyString()))
                .thenAnswer(i -> codigos.stream()
                        .filter(c -> c.getUsuarioId().equals(i.getArgument(0)) && c.getHuella().equals(i.getArgument(1))
                                && c.getUsadoEn() == null)
                        .findFirst());
        lenient().when(repoCodigos.countByUsuarioIdAndUsadoEnIsNull(anyLong())).thenAnswer(i -> codigos.stream()
                .filter(c -> c.getUsuarioId().equals(i.getArgument(0)) && c.getUsadoEn() == null).count());
        lenient().when(repoCodigos.marcarUsado(anyLong(), any(Instant.class))).thenAnswer(i -> {
            for (CodigoRecuperacion c : codigos) {
                if (c.getId().equals(i.getArgument(0)) && c.getUsadoEn() == null) {
                    c.setUsadoEn(i.getArgument(1));
                    return 1;
                }
            }
            return 0;
        });
        lenient().when(repoCodigos.borrarDe(anyLong())).thenAnswer(i -> {
            int antes = codigos.size();
            codigos.removeIf(c -> c.getUsuarioId().equals(i.getArgument(0)));
            return antes - codigos.size();
        });

        reloj = new RelojManual(Instant.parse("2026-11-22T09:00:10Z"));
        servicio = servicioConClave("clave-maestra-de-pruebas");
    }

    private DosFactoresService servicioConClave(String clave) {
        DosFactoresProperties propiedades = new DosFactoresProperties(null, null, clave);
        return new DosFactoresService(repoFactores, repoCodigos, new CifradoDosFactores(propiedades, "jwt"), propiedades, reloj);
    }

    private String codigoActual(DosFactoresService.Configuracion configuracion, int pasosDesdeAhora) {
        return Totp.codigo(Base32.decodificar(configuracion.secreto()), Totp.paso(reloj.instant()) + pasosDesdeAhora);
    }

    private static String otroCodigo(String codigo) {
        return String.format("%06d", (Integer.parseInt(codigo) + 500_000) % 1_000_000);
    }

    /** Configura y activa la app con el codigo del paso actual; devuelve los codigos de recuperacion. */
    private List<String> activarApp(DosFactoresService.Configuracion configuracion) {
        return servicio.activar(USUARIO, codigoActual(configuracion, 0)).orElseThrow();
    }

    @Test
    void configurarDaUnSecretoDe160BitsQueSeGuardaCifrado() {
        DosFactoresService.Configuracion configuracion = servicio.prepararConfiguracion(USUARIO, "ana");

        assertEquals(20, Base32.decodificar(configuracion.secreto()).length);
        assertTrue(configuracion.uri().startsWith("otpauth://totp/BarHub:ana?secret=" + configuracion.secreto()));
        SegundoFactor guardado = factores.get(USUARIO);
        assertFalse(guardado.isActivo());
        assertFalse(guardado.getSecretoCifrado().contains(configuracion.secreto()));
        assertFalse(servicio.activo(USUARIO));
    }

    @Test
    void conUnCodigoIncorrectoNoSeActiva() {
        DosFactoresService.Configuracion configuracion = servicio.prepararConfiguracion(USUARIO, "ana");

        assertTrue(servicio.activar(USUARIO, otroCodigo(codigoActual(configuracion, 0))).isEmpty());
        assertTrue(servicio.activar(USUARIO, "").isEmpty());
        assertFalse(servicio.activo(USUARIO));
        assertTrue(codigos.isEmpty());
    }

    @Test
    void alActivarlaEntregaDiezCodigosDeRecuperacionQueSoloSeGuardanComoHuella() {
        List<String> entregados = activarApp(servicio.prepararConfiguracion(USUARIO, "ana"));

        assertTrue(servicio.activo(USUARIO));
        assertEquals(DosFactoresService.NUM_CODIGOS, entregados.size());
        assertEquals(DosFactoresService.NUM_CODIGOS, new HashSet<>(entregados).size());
        for (String codigo : entregados) {
            assertTrue(codigo.matches("[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}"), codigo);
        }
        assertEquals(DosFactoresService.NUM_CODIGOS, codigos.size());
        for (CodigoRecuperacion guardado : codigos) {
            assertEquals(64, guardado.getHuella().length());
            assertFalse(entregados.contains(guardado.getHuella()));
        }
    }

    @Test
    void sinConfiguracionPendienteNoSeActivaYConLaActivaNoSeEmpiezaOtra() {
        assertTrue(servicio.activar(USUARIO, "123456").isEmpty());

        activarApp(servicio.prepararConfiguracion(USUARIO, "ana"));
        assertThrows(IllegalStateException.class, () -> servicio.prepararConfiguracion(USUARIO, "ana"));
    }

    @Test
    void volverAEmpezarLaConfiguracionCambiaElSecreto() {
        DosFactoresService.Configuracion primera = servicio.prepararConfiguracion(USUARIO, "ana");
        DosFactoresService.Configuracion segunda = servicio.prepararConfiguracion(USUARIO, "ana");

        assertNotEquals(primera.secreto(), segunda.secreto());
        assertTrue(servicio.activar(USUARIO, codigoActual(primera, 0)).isEmpty());
        assertTrue(servicio.activar(USUARIO, codigoActual(segunda, 0)).isPresent());
    }

    @Test
    void elCodigoDeLaAppValeUnaSolaVez() {
        DosFactoresService.Configuracion configuracion = servicio.prepararConfiguracion(USUARIO, "ana");
        String codigoDeActivacion = codigoActual(configuracion, 0);
        servicio.activar(USUARIO, codigoDeActivacion).orElseThrow();

        // el mismo codigo con el que se activo ya no sirve para entrar
        assertFalse(servicio.verificar(USUARIO, codigoDeActivacion).valida());

        reloj.avanzar(Duration.ofSeconds(30));
        String siguiente = codigoActual(configuracion, 0);
        DosFactoresService.Verificacion verificacion = servicio.verificar(USUARIO, siguiente);
        assertTrue(verificacion.valida());
        assertFalse(verificacion.conCodigoRecuperacion());
        assertFalse(servicio.verificar(USUARIO, siguiente).valida());

        // con espacios, como lo muestran algunas apps ("123 456")
        reloj.avanzar(Duration.ofSeconds(30));
        String conEspacio = codigoActual(configuracion, 0);
        assertTrue(servicio.verificar(USUARIO, conEspacio.substring(0, 3) + " " + conEspacio.substring(3)).valida());
    }

    @Test
    void unCodigoDeLaAppDeHaceDosPasosYaNoVale() {
        DosFactoresService.Configuracion configuracion = servicio.prepararConfiguracion(USUARIO, "ana");
        activarApp(configuracion);

        // tres pasos despues: el de hace dos pasos queda fuera del margen; el de hace uno, no
        reloj.avanzar(Duration.ofSeconds(90));
        assertFalse(servicio.verificar(USUARIO, codigoActual(configuracion, -2)).valida());
        assertTrue(servicio.verificar(USUARIO, codigoActual(configuracion, -1)).valida());
    }

    @Test
    void cadaCodigoDeRecuperacionSirveUnaVezYSeCuentanLosQueQuedan() {
        List<String> entregados = activarApp(servicio.prepararConfiguracion(USUARIO, "ana"));

        DosFactoresService.Verificacion primera = servicio.verificar(USUARIO, entregados.get(0));
        assertTrue(primera.valida());
        assertTrue(primera.conCodigoRecuperacion());
        assertEquals(9, primera.codigosRestantes());
        assertFalse(servicio.verificar(USUARIO, entregados.get(0)).valida());

        // en minusculas y sin guion tambien vale
        DosFactoresService.Verificacion segunda = servicio.verificar(USUARIO, entregados.get(1).replace("-", "").toLowerCase());
        assertTrue(segunda.valida());
        assertEquals(8, segunda.codigosRestantes());
    }

    @Test
    void sinActivarONoConCodigosRarosNoSeVerificaNada() {
        DosFactoresService.Configuracion configuracion = servicio.prepararConfiguracion(USUARIO, "ana");
        assertFalse(servicio.verificar(USUARIO, codigoActual(configuracion, 0)).valida());

        activarApp(configuracion);
        for (String raro : new String[]{null, "", "12345", "1234567", "ABCDE", "ABCDE-FGHJK-MNPQR"}) {
            assertFalse(servicio.verificar(USUARIO, raro).valida(), String.valueOf(raro));
        }
        assertFalse(servicio.verificar(99L, "123456").valida());
    }

    @Test
    void siCambiaLaClaveDelServidorElCodigoEsIncorrectoSinRomperElLogin() {
        DosFactoresService.Configuracion configuracion = servicio.prepararConfiguracion(USUARIO, "ana");
        activarApp(configuracion);
        reloj.avanzar(Duration.ofSeconds(30));

        DosFactoresService conOtraClave = servicioConClave("otra-clave");
        assertFalse(conOtraClave.verificar(USUARIO, codigoActual(configuracion, 0)).valida());
    }

    @Test
    void elRolDecideSiEsObligatoria() {
        assertTrue(servicio.obligatorio(List.of("ROLE_ADMIN")));
        assertTrue(servicio.obligatorio(List.of("ROLE_EMPLEADO")));
        assertFalse(servicio.obligatorio(List.of("ROLE_CLIENTE")));
    }

    private static final class RelojManual extends Clock {
        private Instant ahora;

        RelojManual(Instant inicio) {
            this.ahora = inicio;
        }

        void avanzar(Duration duracion) {
            ahora = ahora.plus(duracion);
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
