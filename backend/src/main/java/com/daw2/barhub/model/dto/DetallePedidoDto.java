package com.daw2.barhub.model.dto;

import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Producto;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class DetallePedidoDto {
    private Long id;

    @JsonProperty("id_pedido")
    private Long idPedido;

    @JsonProperty("id_producto")
    private Long idProducto;

    @JsonProperty("producto_nombre")
    private String productoNombre;

    private Integer cantidad;

    @JsonProperty("precio_unitario")
    private BigDecimal precioUnitario;

    public static DetallePedidoDto from(DetallePedido detallePedido) {
        if (detallePedido == null) {
            return null;
        }

        DetallePedidoDto dto = new DetallePedidoDto();
        dto.setId(detallePedido.getId());

        if (detallePedido.getPedido() != null) {
            dto.setIdPedido(detallePedido.getPedido().getId());
        }

        if (detallePedido.getProducto() != null) {
            dto.setIdProducto(detallePedido.getProducto().getId());
            dto.setProductoNombre(detallePedido.getProducto().getNombre());
        }

        dto.setCantidad(detallePedido.getCantidad());
        dto.setPrecioUnitario(detallePedido.getPrecioUnitario());

        return dto;
    }

    public static List<DetallePedidoDto> from(List<DetallePedido> detallePedidos) {
        List<DetallePedidoDto> dtos = new ArrayList<>();
        if (detallePedidos != null) {
            for (DetallePedido detallePedido : detallePedidos) {
                dtos.add(from(detallePedido));
            }
        }
        return dtos;
    }

    public DetallePedido to() {
        DetallePedido detallePedido = new DetallePedido();
        detallePedido.setId(getId());

        if (idPedido != null) {
            Pedido pedidoEntity = new Pedido();
            pedidoEntity.setId(idPedido);
            detallePedido.setPedido(pedidoEntity);
        }

        if (idProducto != null) {
            Producto productoEntity = new Producto();
            productoEntity.setId(idProducto);
            detallePedido.setProducto(productoEntity);
        }

        detallePedido.setCantidad(getCantidad());
        detallePedido.setPrecioUnitario(getPrecioUnitario());

        return detallePedido;
    }

    public Long getProductoId() {
        return this.idProducto;
    }
}