package com.daw2.barhub.model.dto;

import com.daw2.barhub.model.enums.Alergeno;
import com.daw2.barhub.model.enums.TipoProducto;
import com.daw2.barhub.model.entity.Producto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class ProductoDto {

    private Long id;

    @NotBlank
    @Size(max = 100)
    private String nombre;

    @Size(max = 500)
    private String descripcion;

    /** Traducciones para la carta en portugues e ingles; vacias o null, la carta usa el espanol. */
    @Size(max = 100)
    private String nombrePt;

    @Size(max = 100)
    private String nombreEn;

    @Size(max = 500)
    private String descripcionPt;

    @Size(max = 500)
    private String descripcionEn;

    @NotNull
    @Positive
    private Double precio;

    private String imagen;

    @NotNull
    private TipoProducto tipoProducto;

    /**
     * Alergenos que contiene, ordenados. Null: el bar aun no los ha indicado (la carta dice que se
     * pregunte). Lista vacia: indicados, no lleva ninguno de declaracion obligatoria.
     */
    @Size(max = 14)
    private List<@NotNull Alergeno> alergenos;

    public static ProductoDto from(Producto producto) {
        ProductoDto dto = null;

        if (producto != null) {
            dto = new ProductoDto();
            dto.setId(producto.getId());
            dto.setNombre(producto.getNombre());
            dto.setDescripcion(producto.getDescripcion());
            dto.setNombrePt(producto.getNombrePt());
            dto.setNombreEn(producto.getNombreEn());
            dto.setDescripcionPt(producto.getDescripcionPt());
            dto.setDescripcionEn(producto.getDescripcionEn());
            dto.setPrecio(producto.getPrecio());
            dto.setImagen(producto.getImagen());
            dto.setTipoProducto(producto.getTipoProducto());
            Set<Alergeno> indicados = producto.alergenosIndicados();
            dto.setAlergenos(indicados == null ? null : new ArrayList<>(indicados));
        }

        return dto;
    }

    public static List<ProductoDto> from(List<Producto> productos) {
        List<ProductoDto> dtos = new ArrayList<>();

        if (productos != null) {
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
        producto.setNombrePt(opcional(this.getNombrePt()));
        producto.setNombreEn(opcional(this.getNombreEn()));
        producto.setDescripcionPt(opcional(this.getDescripcionPt()));
        producto.setDescripcionEn(opcional(this.getDescripcionEn()));
        producto.setPrecio(this.getPrecio());
        producto.setImagen(this.getImagen());
        producto.setTipoProducto(this.getTipoProducto());
        producto.indicarAlergenos(this.getAlergenos());

        return producto;
    }

    /** Una traduccion en blanco cuenta como sin traducir. */
    private static String opcional(String texto) {
        return texto == null || texto.isBlank() ? null : texto.strip();
    }
}
