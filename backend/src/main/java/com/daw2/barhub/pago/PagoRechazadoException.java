package com.daw2.barhub.pago;

import org.springframework.http.HttpStatus;

/** Un pago que no se acepta, con la respuesta HTTP y un mensaje que se puede ensenar al cliente. */
public class PagoRechazadoException extends RuntimeException {

    private final HttpStatus estado;

    public PagoRechazadoException(HttpStatus estado, String mensaje) {
        super(mensaje);
        this.estado = estado;
    }

    public HttpStatus getEstado() {
        return estado;
    }
}
