package com.daw2.barhub.auth.correo;

/** Ya hay otra cuenta con ese correo. */
public class CorreoEnUsoException extends RuntimeException {

    public CorreoEnUsoException() {
        super("Ya hay una cuenta con ese correo.");
    }
}
