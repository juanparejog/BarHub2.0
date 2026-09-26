package com.daw2.barhub.model.dto.seguimiento;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class DetallePedidoDto {
    private String productoNombre;
    private Integer cantidad;
    private BigDecimal precioUnitario;
    private BigDecimal total;
}