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
}
