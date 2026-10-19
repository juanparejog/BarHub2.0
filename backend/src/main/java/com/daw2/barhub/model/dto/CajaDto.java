package com.daw2.barhub.model.dto;
import com.daw2.barhub.model.enums.EstadoCaja;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class CajaDto {
    private Long id;
    private LocalDateTime fechaApertura;
    private LocalDateTime fechaCierre;
    private BigDecimal montoInicial;
    private BigDecimal ventasEfectivo;
    private BigDecimal ventasTarjeta;
    private BigDecimal efectivoReal;
    private BigDecimal efectivoEsperado;
    private BigDecimal diferencia;
    private EstadoCaja estado;
    private String observaciones;
    private String nombreUsuarioApertura;
    private String nombreUsuarioCierre;
}
