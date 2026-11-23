package com.daw2.barhub.auditoria;

/** Como acabo la accion, segun la respuesta del servidor. */
public enum ResultadoAuditoria {
    /** 2xx. */
    CORRECTO,
    /** 4xx (credenciales o codigo incorrectos, sin permiso, datos no validos...), salvo 429. */
    RECHAZADO,
    /** 429: bloqueo por demasiados intentos. */
    BLOQUEADO,
    /** 5xx o excepcion no controlada. */
    ERROR
}
