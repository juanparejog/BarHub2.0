package com.daw2.barhub.auditoria;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Al terminar una peticion a un endpoint con {@link Auditar}, anota la accion con su resultado.
 * Va antes que la reautenticacion (ver AuditoriaConfig): si esta para la accion con un 403, tambien
 * queda anotado. Un fallo al guardar la entrada no afecta a la respuesta.
 */
@Slf4j
@Component
public class AuditoriaInterceptor implements HandlerInterceptor {

    private final AuditoriaService auditoria;

    public AuditoriaInterceptor(AuditoriaService auditoria) {
        this.auditoria = auditoria;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (!(handler instanceof HandlerMethod metodo)) {
            return;
        }
        Auditar anotacion = metodo.getMethodAnnotation(Auditar.class);
        if (anotacion == null) {
            return;
        }
        try {
            auditoria.registrar(anotacion.value(), request, response.getStatus(), ex);
        } catch (RuntimeException e) {
            log.warn("No se pudo guardar la entrada de auditoria de {}", anotacion.value(), e);
        }
    }
}
