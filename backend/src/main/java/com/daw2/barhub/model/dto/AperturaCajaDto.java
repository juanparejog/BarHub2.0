package com.daw2.barhub.model.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AperturaCajaDto {
    @NotNull(message = "El monto inicial es obligatorio")
    @PositiveOrZero(message = "El monto inicial no puede ser negativo")
    private BigDecimal montoInicial;

    private String observaciones;
}
