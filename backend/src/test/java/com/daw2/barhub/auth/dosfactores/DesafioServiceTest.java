package com.daw2.barhub.auth.dosfactores;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DesafioServiceTest {

    private RelojManual reloj;
    private DesafioService desafios;

    @BeforeEach
    void preparar() {
        reloj = new RelojManual();
        desafios = new DesafioService(reloj);
    }

    @Test
    void cadaDesafioEsAleatorioYSoloValeParaSuProposito() {
        String token = desafios.crear(7L, "Ana", DesafioService.Proposito.VERIFICAR);

        assertNotEquals(token, desafios.crear(7L, "Ana", DesafioService.Proposito.VERIFICAR));
        assertTrue(token.matches("[\\w-]{43}"));
        DesafioService.Desafio desafio = desafios.consultar(token, DesafioService.Proposito.VERIFICAR).orElseThrow();
        assertEquals(7L, desafio.usuarioId());
        assertEquals("Ana", desafio.usuario());
        assertTrue(desafios.consultar(token, DesafioService.Proposito.CONFIGURAR).isEmpty());
    }

    @Test
    void caducaALosCincoMinutos() {
        String token = desafios.crear(7L, "ana", DesafioService.Proposito.CONFIGURAR);

        reloj.avanzar(DesafioService.DURACION.minusSeconds(1));
        assertTrue(desafios.consultar(token, DesafioService.Proposito.CONFIGURAR).isPresent());
        reloj.avanzar(Duration.ofSeconds(1));
        assertTrue(desafios.consultar(token, DesafioService.Proposito.CONFIGURAR).isEmpty());
    }

    @Test
    void alAgotarLosIntentosDejaDeValer() {
        String token = desafios.crear(7L, "ana", DesafioService.Proposito.VERIFICAR);

        for (int i = 1; i < DesafioService.MAX_INTENTOS; i++) {
            assertTrue(desafios.registrarFallo(token), "fallo " + i);
        }
        assertFalse(desafios.registrarFallo(token));
        assertTrue(desafios.consultar(token, DesafioService.Proposito.VERIFICAR).isEmpty());
    }

    @Test
    void usarloLoAnulaYUnTokenDesconocidoNoVale() {
        String token = desafios.crear(7L, "ana", DesafioService.Proposito.VERIFICAR);
        desafios.consumir(token);

        assertTrue(desafios.consultar(token, DesafioService.Proposito.VERIFICAR).isEmpty());
        assertTrue(desafios.consultar("inventado", DesafioService.Proposito.VERIFICAR).isEmpty());
        assertTrue(desafios.consultar(null, DesafioService.Proposito.VERIFICAR).isEmpty());
        assertFalse(desafios.registrarFallo("inventado"));
    }

    private static final class RelojManual extends Clock {
        private Instant ahora = Instant.parse("2026-11-22T09:00:00Z");

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
