package com.daw2.barhub.controller;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Lectura de los avisos de la CSP: los dos formatos, campos recortados y cupo por minuto. */
class CspInformeControllerTest {

    /** Reloj que se puede adelantar. */
    private static final class RelojManual extends Clock {
        private Instant ahora = Instant.parse("2026-11-23T10:00:00Z");

        void avanzar(long segundos) {
            ahora = ahora.plusSeconds(segundos);
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

    private final RelojManual reloj = new RelojManual();
    private final CspInformeController controlador = new CspInformeController(JsonMapper.builder().build(), reloj);

    @Test
    void leeElFormatoDeReportUri() {
        List<CspInformeController.Infraccion> infracciones = controlador.leer("""
                {"csp-report": {"document-uri": "https://barhub.test/carta", "violated-directive": "script-src-elem",
                 "effective-directive": "script-src-elem", "blocked-uri": "https://malo.test/x.js",
                 "source-file": "https://barhub.test/main.js", "line-number": 12, "disposition": "enforce"}}
                """);

        assertEquals(1, infracciones.size());
        CspInformeController.Infraccion infraccion = infracciones.get(0);
        assertEquals("script-src-elem", infraccion.directiva());
        assertEquals("https://malo.test/x.js", infraccion.bloqueado());
        assertEquals("https://barhub.test/carta", infraccion.pagina());
        assertEquals("https://barhub.test/main.js:12", infraccion.origen());
        assertEquals("enforce", infraccion.modo());
    }

    @Test
    void leeElFormatoDeLaReportingApiYSoloLosAvisosDeCsp() {
        List<CspInformeController.Infraccion> infracciones = controlador.leer("""
                [{"type": "csp-violation", "body": {"documentURL": "https://barhub.test/", "effectiveDirective": "img-src",
                  "blockedURL": "https://malo.test/p.png", "disposition": "report"}},
                 {"type": "deprecation", "body": {"id": "algo"}}]
                """);

        assertEquals(1, infracciones.size());
        assertEquals("img-src", infracciones.get(0).directiva());
        assertEquals("report", infracciones.get(0).modo());
        assertEquals("-", infracciones.get(0).origen());
    }

    @Test
    void unCuerpoQueNoEsUnAvisoNoDaNada() {
        assertTrue(controlador.leer("esto no es json").isEmpty());
        assertTrue(controlador.leer("{\"otra\": 1}").isEmpty());
        assertTrue(controlador.leer("[1, \"dos\"]").isEmpty());
    }

    @Test
    void losCamposNoPuedenInventarLineasDelLogNiSerEnormes() {
        String limpio = CspInformeController.limpiar("a\r\nCSP: linea falsa\u0000");
        assertFalse(limpio.contains("\n") || limpio.contains("\r") || limpio.contains("\u0000"));
        assertEquals(203, CspInformeController.limpiar("x".repeat(1000)).length());
    }

    @Test
    void comoMuchoSesentaAvisosPorMinuto() {
        for (int i = 0; i < CspInformeController.MAXIMO_POR_MINUTO; i++) {
            assertTrue(controlador.cabeEnElCupo());
        }
        assertFalse(controlador.cabeEnElCupo());

        reloj.avanzar(60);
        assertTrue(controlador.cabeEnElCupo(), "al minuto siguiente vuelve a anotar");
    }
}
