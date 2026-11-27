package com.daw2.barhub.auditoria;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Como se traduce la respuesta a un resultado, y como se recortan los textos. */
class AuditoriaServiceTest {

    @Test
    void elResultadoSaleDelEstadoYDeLaExcepcion() {
        assertEquals(ResultadoAuditoria.CORRECTO, AuditoriaService.resultado(200, null));
        assertEquals(ResultadoAuditoria.CORRECTO, AuditoriaService.resultado(204, null));
        assertEquals(ResultadoAuditoria.RECHAZADO, AuditoriaService.resultado(400, null));
        assertEquals(ResultadoAuditoria.RECHAZADO, AuditoriaService.resultado(403, null));
        assertEquals(ResultadoAuditoria.BLOQUEADO, AuditoriaService.resultado(429, null));
        assertEquals(ResultadoAuditoria.ERROR, AuditoriaService.resultado(500, null));
        // El login con la contrasena mal lanza la excepcion y Spring Security responde el 401
        assertEquals(ResultadoAuditoria.RECHAZADO, AuditoriaService.resultado(200, new BadCredentialsException("x")));
        assertEquals(ResultadoAuditoria.RECHAZADO, AuditoriaService.resultado(200, new AccessDeniedException("x")));
        assertEquals(ResultadoAuditoria.ERROR, AuditoriaService.resultado(200, new IllegalStateException("x")));
    }

    @Test
    void laLineaDelSocLlevaAccionResultadoEIpYNadaMas() {
        EventoAuditoria evento = new EventoAuditoria();
        evento.setAccion(AccionAuditoria.INICIO_SESION);
        evento.setResultado(ResultadoAuditoria.RECHAZADO);
        evento.setIp("203.0.113.7");
        evento.setUsuario("ana");
        evento.setDetalle("motivo");
        assertEquals("evento=auditoria accion=INICIO_SESION resultado=RECHAZADO ip=203.0.113.7",
                AuditoriaService.lineaDelSoc(evento));

        // Sin IP (cuenta eliminada o accion que no la guarda) y con un valor que intentara meter campos
        evento.setIp(null);
        assertEquals("evento=auditoria accion=INICIO_SESION resultado=RECHAZADO ip=-", AuditoriaService.lineaDelSoc(evento));
        evento.setIp("1.2.3.4 resultado=CORRECTO");
        assertEquals("evento=auditoria accion=INICIO_SESION resultado=RECHAZADO ip=1.2.3.4_resultado=CORRECTO",
                AuditoriaService.lineaDelSoc(evento));
    }

    @Test
    void losTextosNoPuedenInventarLineasNiPasarseDeLargo() {
        String recortado = AuditoriaService.recortar("ana\r\nINICIO_SESION CORRECTO admin", 50);
        assertFalse(recortado.contains("\n") || recortado.contains("\r"));
        assertEquals(10, AuditoriaService.recortar("x".repeat(80), 10).length());
        assertNull(AuditoriaService.recortar(null, 10));
    }
}
