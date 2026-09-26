package com.daw2.barhub.model.dto;

import com.daw2.barhub.model.Enum.TipoProducto;
import com.daw2.barhub.model.entity.Producto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class ProductoDto {
    private Long id;
    private String nombre;
    private String descripcion;
    private Double precio;
    private String imagen;
    private TipoProducto tipoProducto;

    public static ProductoDto from(Producto producto) {
        ProductoDto dto = null;

        if (producto != null) {
            dto = new ProductoDto();
            dto.setId(producto.getId());
            dto.setNombre(producto.getNombre());
            dto.setDescripcion(producto.getDescripcion());
            dto.setPrecio(producto.getPrecio());
            dto.setImagen(producto.getImagen());
            dto.setTipoProducto(producto.getTipoProducto());
        }

        return dto;
    }

    public static List<ProductoDto> from(List<Producto> productos) {
        List<ProductoDto> dtos = new ArrayList<>();

        if (productos != null) {
            dtos = new ArrayList<ProductoDto>();
            for (Producto producto : productos) {
                dtos.add(from(producto));
            }
        }

        return dtos;
    }

    public Producto to() {
        Producto producto = new Producto();

        producto.setId(this.getId());
        producto.setNombre(this.getNombre());
        producto.setDescripcion(this.getDescripcion());
        producto.setPrecio(this.getPrecio());
        producto.setImagen(this.getImagen());
        producto.setTipoProducto(this.getTipoProducto());

        return producto;
    }
}