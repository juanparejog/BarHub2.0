package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.enums.EstadoPago;
import com.daw2.barhub.model.enums.EstadoPedido;
import com.daw2.barhub.model.enums.TipoPedido;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.time.LocalDateTime;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class PedidoDto {

    private Long id;

    @JsonProperty("id_user")
    @JsonAlias({"idUser", "userId", "user_id"})
    private Long idUser;

    @JsonProperty("id_mesa")
    @JsonAlias({"idMesa", "mesaId", "mesa_id"})
    private Long idMesa;

    @JsonProperty("tipo_pedido")
    @JsonAlias({"tipoPedido", "tipo", "tipoServicio"})
    private TipoPedido tipoPedido;

    @JsonProperty("direccion_envio")
    @JsonAlias({"direccionEnvio", "direccion"})
    private String direccionEnvio;

    @JsonProperty("telefono_contacto")
    @JsonAlias({"telefonoContacto", "telefono"})
    private String telefonoContacto;

    private LocalDateTime fecha;

    private EstadoPedido estado;

    @JsonProperty("estado_pago")
    @JsonAlias({"estadoPago"})
    private EstadoPago estadoPago = EstadoPago.PENDIENTE;

    @JsonProperty("precio_total")
    @JsonAlias({"precioTotal", "total"})
    private BigDecimal precioTotal;

    @JsonProperty("metodo_pago")
    @JsonAlias({"metodoPago"})
    private String metodoPago;

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
        dto.setEstadoPago(pedido.getEstadoPago());
        dto.setPrecioTotal(pedido.getPrecioTotal());
        dto.setMetodoPago(pedido.getMetodoPago());

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

    /**
     * Convierte el DTO a la Entidad Pedido respetando las reglas de negocio de cada modalidad.
     */
    public Pedido to() {
        Pedido pedido = new Pedido();
        pedido.setId(getId());

        if (idUser != null && idUser > 0) {
            User userEntity = new User();
            userEntity.setId(idUser);
            pedido.setUser(userEntity);
        }

        // Asignación estricta de Mesa: Solo si idMesa es válido y no es nulo
        if (idMesa != null && idMesa > 0) {
            Mesa mesaEntity = new Mesa();
            mesaEntity.setId(idMesa);
            pedido.setMesa(mesaEntity);
        } else {
            pedido.setMesa(null);
        }

        // Mantiene el tipoPedido que viene en el DTO o deduce MESA si se especificó una mesa válida
        if (getTipoPedido() != null) {
            pedido.setTipoPedido(getTipoPedido());
        } else if (getIdMesa() != null && getIdMesa() > 0) {
            pedido.setTipoPedido(TipoPedido.MESA);
        } else if (getDireccionEnvio() != null && !getDireccionEnvio().trim().isEmpty()) {
            pedido.setTipoPedido(TipoPedido.DOMICILIO);
        } else {
            pedido.setTipoPedido(TipoPedido.RECOGER);
        }

        pedido.setDireccionEnvio(getDireccionEnvio());
        pedido.setTelefonoContacto(getTelefonoContacto());
        pedido.setFecha(getFecha());
        pedido.setEstado(getEstado());
        pedido.setEstadoPago(getEstadoPago() != null ? getEstadoPago() : EstadoPago.PENDIENTE);
        pedido.setPrecioTotal(getPrecioTotal());
        pedido.setMetodoPago(getMetodoPago());

        return pedido;
    }

    // Getters / Setters de compatibilidad para el Frontend Angular
    public BigDecimal getTotal() {
        return this.precioTotal;
    }

    public void setTotal(BigDecimal total) {
        this.precioTotal = total;
    }

    @JsonProperty("mesaId")
    public Long getMesaId() {
        return this.idMesa;
    }

    @JsonProperty("userId")
    public Long getUserId() {
        return this.idUser;
    }

    @JsonProperty("tipoPedido")
    public TipoPedido getTipoPedidoCamelCase() {
        return this.tipoPedido;
    }

    @JsonProperty("direccionEnvio")
    public String getDireccionEnvioCamelCase() {
        return this.direccionEnvio;
    }

    @JsonProperty("telefonoContacto")
    public String getTelefonoContactoCamelCase() {
        return this.telefonoContacto;
    }

    @JsonProperty("precioTotal")
    public BigDecimal getPrecioTotalCamelCase() {
        return this.precioTotal;
    }

    @JsonProperty("metodoPago")
    public String getMetodoPagoCamelCase() {
        return this.metodoPago;
    }

    @JsonProperty("estadoPago")
    public EstadoPago getEstadoPagoCamelCase() {
        return this.estadoPago;
    }
}