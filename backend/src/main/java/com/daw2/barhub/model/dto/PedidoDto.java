package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.Enum.EstadoPedido;
import com.daw2.barhub.model.Enum.TipoPedido;
import com.daw2.barhub.model.dto.DetallePedidoDto;
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

    @JsonProperty("tipo_pedido")
    private TipoPedido tipoPedido = TipoPedido.MESA;

    @JsonProperty("direccion_envio")
    private String direccionEnvio;

    @JsonProperty("telefono_contacto")
    private String telefonoContacto;

    private Date fecha;
    private EstadoPedido estado;

    @JsonProperty("precio_total")
    private BigDecimal precioTotal;

    private String paymentMethodId;

    private List<DetallePedidoDto> detalles = new ArrayList<>();

    public static PedidoDto from(Pedido pedido) {
        if (pedido == null) {
            return null;
        }

        PedidoDto dto = new PedidoDto();
        dto.setId(pedido.getId());

        if (pedido.getUser() != null) {
            dto.setIdUser(pedido.getUser().getId());
        }

        if (pedido.getMesa() != null) {
            dto.setIdMesa(pedido.getMesa().getId());
        }

        dto.setTipoPedido(pedido.getTipoPedido());
        dto.setDireccionEnvio(pedido.getDireccionEnvio());
        dto.setTelefonoContacto(pedido.getTelefonoContacto());
        dto.setFecha(pedido.getFecha());
        dto.setEstado(pedido.getEstado());
        dto.setPrecioTotal(pedido.getPrecioTotal());
        dto.setPaymentMethodId(pedido.getPaymentMethodId());

        if (pedido.getDetalles() != null && !pedido.getDetalles().isEmpty()) {
            dto.setDetalles(DetallePedidoDto.from(pedido.getDetalles()));
        }

        return dto;
    }

    public static List<PedidoDto> from(List<Pedido> pedidos) {
        List<PedidoDto> dtos = new ArrayList<>();
        if (pedidos != null) {
            for (Pedido pedido : pedidos) {
                dtos.add(from(pedido));
            }
        }
        return dtos;
    }

    public Pedido to() {
        Pedido pedido = new Pedido();
        pedido.setId(getId());

        if (idUser != null && idUser > 0) {
            User userEntity = new User();
            userEntity.setId(idUser);
            pedido.setUser(userEntity);
        }

        if (idMesa != null && idMesa > 0) {
            Mesa mesaEntity = new Mesa();
            mesaEntity.setId(idMesa);
            pedido.setMesa(mesaEntity);
        }

        pedido.setTipoPedido(getTipoPedido() != null ? getTipoPedido() : TipoPedido.MESA);
        pedido.setDireccionEnvio(getDireccionEnvio());
        pedido.setTelefonoContacto(getTelefonoContacto());
        pedido.setFecha(getFecha());
        pedido.setEstado(getEstado());
        pedido.setPrecioTotal(getPrecioTotal());
        pedido.setPaymentMethodId(getPaymentMethodId());

        return pedido;
    }

    // Compatibilidad con invocaciones antiguas .getTotal()
    public BigDecimal getTotal() {
        return this.precioTotal;
    }

    public void setTotal(BigDecimal total) {
        this.precioTotal = total;
    }

    public Long getMesaId() {
        return this.idMesa;
    }

    public Long getUserId() {
        return this.idUser;
    }
}