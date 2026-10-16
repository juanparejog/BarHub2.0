package com.daw2.barhub.model.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CierreCajaDto {
    @NotNull(message = "El efectivo contado es obligatorio")
    @PositiveOrZero(message = "El efectivo contado no puede ser negativo")
    private BigDecimal efectivoReal;

    private String observaciones;
}
