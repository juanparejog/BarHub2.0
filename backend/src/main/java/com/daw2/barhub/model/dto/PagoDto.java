package com.daw2.barhub.model.dto;

import com.daw2.barhub.model.Enum.EstadoPago;
import com.daw2.barhub.model.Enum.MetodoPago;
import com.daw2.barhub.model.entity.Pago;
import com.daw2.barhub.model.entity.Pedido;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class PagoDto {
    private Long id;

    @JsonProperty("id_pedido")
    private Long idPedido;

    @JsonProperty("estado_pago")
    private EstadoPago estadoPago;

    @JsonProperty("metodo_pago")
    private MetodoPago metodoPago;

    @JsonProperty("total")
    private BigDecimal total;

    @JsonProperty("fecha_pago")
    private LocalDate fechaPago;

    public static PagoDto from(Pago pago) {
        PagoDto dto = null;

        if(pago != null) {
            dto = new PagoDto();
            dto.setId(pago.getId());
            dto.setIdPedido(pago.getPedido().getId());
            dto.setEstadoPago(pago.getEstadoPago());
            dto.setMetodoPago(pago.getMetodoPago());
            dto.setTotal(pago.getTotal());
            dto.setFechaPago(pago.getFechaPago());
        }

        return dto;
    }

    public static List<PagoDto> from(List<Pago> pagos) {
        List<PagoDto> dtos = new ArrayList<>();

        if(pagos != null) {
            dtos = new ArrayList<PagoDto>();
            for(Pago pago : pagos) {
                dtos.add(from(pago));
            }
        }

        return dtos;
    }

    public Pago to() {
        Pago pago = new Pago();

        pago.setId(getId());

        if(idPedido != null) {
            Pedido pedido = new Pedido();
            pedido.setId(idPedido);
            pago.setPedido(pedido);
        }

        pago.setEstadoPago(getEstadoPago());
        pago.setMetodoPago(getMetodoPago());
        pago.setTotal(getTotal());
        pago.setFechaPago(getFechaPago());

        return pago;
    }
}