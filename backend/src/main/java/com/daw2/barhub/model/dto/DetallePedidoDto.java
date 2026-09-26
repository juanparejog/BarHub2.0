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

    private Integer cantidad;

    @JsonProperty("precio_unitario")
    private BigDecimal precioUnitario;

    public static DetallePedidoDto from(DetallePedido detallePedido){
        DetallePedidoDto dto = null;

        if(detallePedido != null){
            dto = new DetallePedidoDto();
            dto.setId(detallePedido.getId());
            dto.setIdPedido(detallePedido.getPedido().getId());
            dto.setIdProducto(detallePedido.getProducto().getId());
            dto.setCantidad(detallePedido.getCantidad());
            dto.setPrecioUnitario(detallePedido.getPrecioUnitario());
        }

        return dto;
    }

    public static List<DetallePedidoDto> from(List<DetallePedido> detallePedidos){
        List<DetallePedidoDto> dtos = new ArrayList<>();

        if (detallePedidos != null){
            dtos = new ArrayList<DetallePedidoDto>();
            for (DetallePedido detallePedido : detallePedidos){
                dtos.add(from(detallePedido));
            }
        }

        return dtos;
    }

    public DetallePedido to() {
        DetallePedido detallePedido = new DetallePedido();

        detallePedido.setId(getId());

        if(idPedido != null){
            Pedido pedidoEntity = new Pedido();
            pedidoEntity.setId(idPedido);
            detallePedido.setPedido(pedidoEntity);
        }

        if(idProducto != null){
            Producto productoEntity = new Producto();
            productoEntity.setId(idProducto);
            detallePedido.setProducto(productoEntity);
        }

        detallePedido.setCantidad(getCantidad());
        detallePedido.setPrecioUnitario(getPrecioUnitario());

        return detallePedido;
    }
}