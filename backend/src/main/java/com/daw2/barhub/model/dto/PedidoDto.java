package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.Enum.EstadoPedido;
import com.daw2.barhub.model.dto.seguimiento.DetallePedidoDto;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class PedidoDto {
    private Long id;

    @JsonProperty("id_user")
    private Long idUser;

    @JsonProperty("id_mesa")
    private Long idMesa;

    private Date fecha;
    private EstadoPedido estado;
    private BigDecimal total;
    private String paymentMethodId;

    public static PedidoDto from(Pedido pedido) {
        PedidoDto dto = null;

        if (pedido != null) {
            dto = new PedidoDto();
            dto.setId(pedido.getId());
            if (pedido.getUser() != null) {
                dto.setIdUser(pedido.getUser().getId());
            } else {
                dto.setIdUser(null);
            }

            dto.setIdMesa(pedido.getMesa().getId());
            dto.setFecha(pedido.getFecha());
            dto.setEstado(pedido.getEstado());
            dto.setTotal(pedido.getPrecioTotal());
            dto.setPaymentMethodId(pedido.getPaymentMethodId());
        }

        return dto;
    }

    public static List<PedidoDto> from(List<Pedido> pedidos){
        List<PedidoDto> dtos = new ArrayList<>();

        if (pedidos != null) {
            dtos = new ArrayList<PedidoDto>();
            for (Pedido pedido : pedidos) {
                dtos.add(from(pedido));
            }
        }

        return dtos;
    }

    public Pedido to() {
        Pedido pedido = new Pedido();

        pedido.setId(getId());

        if(idUser > 0) {
            User userEntity = new User();
            userEntity.setId((Long) idUser);
            pedido.setUser(userEntity);
        }

        if(idMesa > 0) {
            Mesa mesaEntity = new Mesa();
            mesaEntity.setId((long) idMesa);
            pedido.setMesa(mesaEntity);
        }

        pedido.setFecha(getFecha());
        pedido.setEstado(getEstado());
        pedido.setPrecioTotal(getTotal());
        pedido.setPaymentMethodId(this.getPaymentMethodId());

        return pedido;
    }
}