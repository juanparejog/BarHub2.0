package com.daw2.barhub.auth.services;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoginAttemptServiceTest {

    /** Reloj que se mueve a mano para no tener que esperar 15 minutos reales. */
    private static final class RelojManual extends Clock {
        private Instant ahora = Instant.parse("2026-01-01T10:00:00Z");

        void avanzar(Duration d) {
            ahora = ahora.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return ahora;
        }
    }

    private RelojManual reloj;
    private LoginAttemptService servicio;

    @BeforeEach
    void preparar() {
        reloj = new RelojManual();
        servicio = new LoginAttemptService(reloj);
    }

    private void fallar(String usuario, int veces) {
        for (int i = 0; i < veces; i++) {
            servicio.registrarFallo(usuario);
        }
    }

    @Test
    void sinFallosNoEstaBloqueado() {
        assertFalse(servicio.estaBloqueado("juan"));
        assertEquals(0, servicio.segundosRestantes("juan"));
    }

    @Test
    void cuatroFallosTodaviaNoBloquean() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS - 1);
        assertFalse(servicio.estaBloqueado("juan"));
    }

    @Test
    void elQuintoFalloBloquea() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS);
        assertTrue(servicio.estaBloqueado("juan"));
        assertEquals(15 * 60, servicio.segundosRestantes("juan"));
    }

    @Test
    void elBloqueoSeLevantaPasadoElTiempo() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS);
        reloj.avanzar(Duration.ofMinutes(14));
        assertTrue(servicio.estaBloqueado("juan"));
        reloj.avanzar(Duration.ofMinutes(2));
        assertFalse(servicio.estaBloqueado("juan"));
    }

    @Test
    void despuesDelBloqueoEmpiezaDeCero() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS);
        reloj.avanzar(Duration.ofMinutes(16));
        fallar("juan", LoginAttemptService.MAX_INTENTOS - 1);
        assertFalse(servicio.estaBloqueado("juan"));
    }

    @Test
    void unLoginCorrectoReiniciaElContador() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS - 1);
        servicio.registrarExito("juan");
        fallar("juan", LoginAttemptService.MAX_INTENTOS - 1);
        assertFalse(servicio.estaBloqueado("juan"));
    }

    @Test
    void losFallosAntiguosNoSeAcumulan() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS - 1);
        reloj.avanzar(Duration.ofMinutes(20));
        fallar("juan", 1);
        assertFalse(servicio.estaBloqueado("juan"));
    }

    @Test
    void cadaUsuarioTieneSuPropioContador() {
        fallar("juan", LoginAttemptService.MAX_INTENTOS);
        assertTrue(servicio.estaBloqueado("juan"));
        assertFalse(servicio.estaBloqueado("maria"));
    }

    @Test
    void mayusculasYEspaciosNoPermitenEsquivarElBloqueo() {
        fallar("Juan", 3);
        fallar(" juan ", 2);
        assertTrue(servicio.estaBloqueado("JUAN"));
    }

    @Test
    void usuarioNuloNoRompeNada() {
        servicio.registrarFallo(null);
        assertFalse(servicio.estaBloqueado(null));
    }

    // ---------- bloqueo por IP ----------

    private void fallarDesde(String ip, int veces) {
        for (int i = 0; i < veces; i++) {
            servicio.registrarFallo("usuario" + i, ip);
        }
    }

    @Test
    void probarMuchasCuentasDesdeUnaIpLaBloquea() {
        fallarDesde("203.0.113.7", LoginAttemptService.MAX_INTENTOS_IP - 1);
        assertEquals(0, servicio.segundosRestantes("otra", "203.0.113.7"));

        fallarDesde("203.0.113.7", 1);
        assertEquals(15 * 60, servicio.segundosRestantes("otra", "203.0.113.7"));
        // ninguna cuenta concreta llega a bloquearse: es la IP
        assertFalse(servicio.estaBloqueado("usuario0"));
    }

    @Test
    void elBloqueoDeUnaIpNoAfectaAOtras() {
        fallarDesde("203.0.113.7", LoginAttemptService.MAX_INTENTOS_IP);
        assertEquals(0, servicio.segundosRestantes("juan", "198.51.100.4"));
    }

    @Test
    void elBloqueoDelUsuarioSeAplicaDesdeCualquierIp() {
        for (int i = 0; i < LoginAttemptService.MAX_INTENTOS; i++) {
            servicio.registrarFallo("juan", "10.0.0." + i);
        }
        assertTrue(servicio.segundosRestantes("juan", "192.0.2.50") > 0);
    }

    @Test
    void unLoginCorrectoNoLimpiaElContadorDeLaIp() {
        fallarDesde("203.0.113.7", LoginAttemptService.MAX_INTENTOS_IP - 1);
        servicio.registrarExito("cuenta-valida");
        fallarDesde("203.0.113.7", 1);
        assertTrue(servicio.segundosRestantes("cualquiera", "203.0.113.7") > 0);
    }

    @Test
    void elBloqueoDeLaIpSeLevantaPasadoElTiempo() {
        fallarDesde("203.0.113.7", LoginAttemptService.MAX_INTENTOS_IP);
        reloj.avanzar(Duration.ofMinutes(16));
        assertEquals(0, servicio.segundosRestantes("juan", "203.0.113.7"));
    }

    @Test
    void sinIpSoloCuentaElUsuario() {
        servicio.registrarFallo("juan", null);
        servicio.registrarFallo("juan", " ");
        assertEquals(0, servicio.segundosRestantes("pedro", null));
    }
}
