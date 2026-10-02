package com.daw2.barhub.model.Enum;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum EstadoPedido {
    pendiente,
    preparado,
    servido;

    @JsonCreator
    public static EstadoPedido fromString(String value) {
        if (value == null) return null;
        for (EstadoPedido estado : EstadoPedido.values()) {
            if (estado.name().equalsIgnoreCase(value)) {
                return estado;
            }
        }
        throw new IllegalArgumentException("Estado desconocido: " + value);
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}