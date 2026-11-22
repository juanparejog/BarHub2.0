package com.daw2.barhub.auth.sesion;

/** El token de renovacion no existe, esta revocado, ha caducado o se ha reutilizado. */
public class SesionInvalidaException extends RuntimeException {

    public SesionInvalidaException(String mensaje) {
        super(mensaje);
    }
}
