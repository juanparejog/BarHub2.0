package com.daw2.barhub.model.dto.seguimiento;

import com.daw2.barhub.model.Enum.EstadoPedido;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Data
public class PedidoDTO {
    private Long id;
    private Date fecha;
    private EstadoPedido estado;
    private BigDecimal total;
    private List<DetallePedidoDto> detalles;
}