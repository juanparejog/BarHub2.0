package com.daw2.barhub.auditoria;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Anota en el registro de auditoria cada llamada a este endpoint, con su resultado (ver
 * {@link AuditoriaInterceptor}). Tambien se anota si la para la reautenticacion o falla.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditar {
    AccionAuditoria value();
}
