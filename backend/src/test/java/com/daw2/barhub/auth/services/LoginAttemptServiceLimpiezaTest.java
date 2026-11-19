package com.daw2.barhub.auth.services;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Limpieza de registros caducados de LoginAttemptService: al llegar al limite de registros en memoria
 * se borran los que ya no sirven, pero un bloqueo que sigue activo no se pierde.
 */
class LoginAttemptServiceLimpiezaTest {

    /** Reloj que el test adelanta a mano. */
    private static final class RelojManual extends Clock {
        private Instant ahora = Instant.parse("2026-01-01T10:00:00Z");

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

    private static int registros(LoginAttemptService servicio) {
        return ((Map<?, ?>) ReflectionTestUtils.getField(servicio, "registros")).size();
    }

    private static void fallosDeUsuariosDistintos(LoginAttemptService servicio, int cuantos) {
        for (int i = 0; i < cuantos; i++) {
            servicio.registrarFallo("usuario" + i);
        }
    }

    @Test
    void alLlegarAlLimiteSeBorranLosRegistrosCaducados() {
        RelojManual reloj = new RelojManual();
        LoginAttemptService servicio = new LoginAttemptService(reloj);
        fallosDeUsuariosDistintos(servicio, 10_000);
        assertEquals(10_000, registros(servicio));

        reloj.avanzar(LoginAttemptService.DURACION_BLOQUEO.plusMinutes(1));
        servicio.registrarFallo("nuevo");

        assertEquals(1, registros(servicio));
    }

    @Test
    void laLimpiezaConservaLosBloqueosActivos() {
        RelojManual reloj = new RelojManual();
        LoginAttemptService servicio = new LoginAttemptService(reloj);
        fallosDeUsuariosDistintos(servicio, 9_999);

        reloj.avanzar(Duration.ofMinutes(10));
        for (int i = 0; i < LoginAttemptService.MAX_INTENTOS; i++) {
            servicio.registrarFallo("atacante");
        }
        assertTrue(servicio.estaBloqueado("atacante"));

        // minuto 16: los 9.999 primeros ya han caducado; el bloqueo dura hasta el minuto 25
        reloj.avanzar(Duration.ofMinutes(6));
        servicio.registrarFallo("otro");

        assertEquals(2, registros(servicio));
        assertTrue(servicio.estaBloqueado("atacante"));
    }
}
