package com.daw2.barhub.model.entity;

import com.daw2.barhub.model.enums.Alergeno;
import com.daw2.barhub.model.enums.TipoProducto;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Data
@Entity
@Table(name="productos")
public class Producto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique=true, nullable=false)
    private String nombre;

    @Column
    private String descripcion;

    /*
     * Nombre y descripcion en portugues y en ingles, para la carta en esos idiomas. Opcionales: si
     * faltan, la carta muestra los de arriba (en espanol).
     */
    @Column(name = "nombre_pt", length = 100)
    private String nombrePt;

    @Column(name = "nombre_en", length = 100)
    private String nombreEn;

    @Column(name = "descripcion_pt", length = 500)
    private String descripcionPt;

    @Column(name = "descripcion_en", length = 500)
    private String descripcionEn;

    @Column
    private Double precio;

    @Column
    private String imagen;

    @Column(name = "tipo_producto", nullable = false)
    @Enumerated(EnumType.STRING)
    private TipoProducto tipoProducto;

    /**
     * Si el bar ya ha indicado los alergenos de este producto. Sin indicar, la carta dice que se
     * pregunte al personal y el filtro de alergenos no lo muestra: una lista vacia no puede pasar por
     * "no lleva ninguno" solo porque nadie la ha rellenado.
     */
    @Column(name = "alergenos_declarados")
    private Boolean alergenosDeclarados;

    /** Alergenos que contiene (solo cuenta si {@link #alergenosDeclarados}). */
    @ElementCollection(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SUBSELECT)
    @CollectionTable(name = "producto_alergenos", joinColumns = @JoinColumn(name = "producto_id"))
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "alergeno", nullable = false, length = 30)
    private Set<Alergeno> alergenos = new HashSet<>();

    /** Los alergenos, o null si aun no se han indicado. */
    public Set<Alergeno> alergenosIndicados() {
        if (!Boolean.TRUE.equals(alergenosDeclarados)) {
            return null;
        }
        return alergenos == null || alergenos.isEmpty() ? EnumSet.noneOf(Alergeno.class) : EnumSet.copyOf(alergenos);
    }

    /** Null deja los alergenos sin indicar; una lista (vacia o no) los da por indicados. */
    public void indicarAlergenos(java.util.Collection<Alergeno> indicados) {
        alergenosDeclarados = indicados != null;
        if (alergenos == null) {
            alergenos = new HashSet<>();
        }
        alergenos.clear();
        if (indicados != null) {
            alergenos.addAll(indicados);
        }
    }

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}