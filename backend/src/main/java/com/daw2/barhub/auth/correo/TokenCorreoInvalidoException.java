package com.daw2.barhub.auth.correo;

/** El enlace no existe, ya se uso, se anulo con uno mas nuevo o ha caducado. */
public class TokenCorreoInvalidoException extends RuntimeException {

    public TokenCorreoInvalidoException() {
        super("El enlace no es válido o ha caducado. Pide uno nuevo.");
    }
}
