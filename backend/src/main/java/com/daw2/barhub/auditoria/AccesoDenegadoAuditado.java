package com.daw2.barhub.auditoria;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.AccessDeniedHandlerImpl;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Un usuario con sesion intenta algo que su rol no permite (403 de Spring Security): se anota como
 * ACCESO_DENEGADO, con la ruta, y se responde como siempre. Muchos seguidos de la misma cuenta son
 * senal de que alguien esta probando hasta donde llega una sesion robada.
 */
@Slf4j
@Component
public class AccesoDenegadoAuditado implements AccessDeniedHandler {

    private final AuditoriaService auditoria;
    private final AccessDeniedHandler respuesta = new AccessDeniedHandlerImpl();

    public AccesoDenegadoAuditado(AuditoriaService auditoria) {
        this.auditoria = auditoria;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException, ServletException {
        try {
            auditoria.registrar(AccionAuditoria.ACCESO_DENEGADO, request, HttpServletResponse.SC_FORBIDDEN, null);
        } catch (RuntimeException e) {
            log.warn("No se pudo guardar la entrada de auditoria de un acceso denegado", e);
        }
        respuesta.handle(request, response, accessDeniedException);
    }
}
