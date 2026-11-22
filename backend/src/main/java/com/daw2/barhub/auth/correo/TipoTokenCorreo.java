package com.daw2.barhub.auth.correo;

import java.time.Duration;

/** Para que sirve un enlace enviado por correo y cuanto dura. */
public enum TipoTokenCorreo {
    VERIFICACION(Duration.ofHours(24)),
    RECUPERACION(Duration.ofMinutes(30));

    private final Duration vigencia;

    TipoTokenCorreo(Duration vigencia) {
        this.vigencia = vigencia;
    }

    public Duration vigencia() {
        return vigencia;
    }
}
