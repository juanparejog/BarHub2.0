package com.daw2.barhub.auditoria;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Datos que un endpoint con {@link Auditar} anade a su entrada del registro, cuando no salen solos
 * de la sesion: quien intento entrar en un login, sobre que usuario se actuo o un detalle. Se
 * guardan en la peticion en curso; fuera de una peticion (tareas programadas, tests unitarios) no
 * hacen nada.
 */
public final class Auditoria {

    static final String USUARIO_ID = Auditoria.class.getName() + ".usuarioId";
    static final String USUARIO = Auditoria.class.getName() + ".usuario";
    static final String OBJETIVO = Auditoria.class.getName() + ".objetivo";
    static final String DETALLE = Auditoria.class.getName() + ".detalle";
    static final String SIN_IP = Auditoria.class.getName() + ".sinIp";

    private Auditoria() {
    }

    /** Quien hace la accion, si aun no hay sesion (login, segundo paso, enlace de un correo). */
    public static void usuario(Long usuarioId, String usuario) {
        poner(USUARIO_ID, usuarioId);
        poner(USUARIO, usuario);
    }

    /** Sobre quien o que se actua, si no es el propio usuario. */
    public static void objetivo(String objetivo) {
        poner(OBJETIVO, objetivo);
    }

    public static void detalle(String detalle) {
        poner(DETALLE, detalle);
    }

    /** Cuenta que se acaba de eliminar: la entrada se guarda sin su nombre de usuario ni su IP. */
    public static void cuentaEliminada(Long usuarioId) {
        usuario(usuarioId, "eliminado-" + usuarioId);
        poner(SIN_IP, Boolean.TRUE);
    }

    private static void poner(String atributo, Object valor) {
        RequestAttributes atributos = RequestContextHolder.getRequestAttributes();
        if (atributos instanceof ServletRequestAttributes servlet) {
            HttpServletRequest peticion = servlet.getRequest();
            peticion.setAttribute(atributo, valor);
        }
    }
}
