package com.daw2.barhub.auth.reautenticacion;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Accion critica del administrador: solo se ejecuta si ha demostrado quien es hace poco en esta
 * sesion (al iniciarla o con POST /auth/reautenticar). Si no, responde 403 REAUTENTICACION_REQUERIDA
 * y el frontend pide el codigo y repite la peticion. Lo comprueba ReautenticacionInterceptor.
 *
 * <p>Solo se aplica a administradores: para el resto de roles decide la seguridad de la ruta.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiereReautenticacion {

    /** Con true solo se exige si la accion es sobre otro usuario (el {id} de la ruta no es el suyo). */
    boolean soloSobreOtroUsuario() default false;
}
