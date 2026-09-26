package com.daw2.barhub.model.entity;

import com.daw2.barhub.model.Enum.TipoProducto;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

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

    @Column
    private Double precio;

    @Column
    private String imagen;

    @Column(name = "tipo_producto", nullable = false)
    @Enumerated(EnumType.STRING)
    private TipoProducto tipoProducto;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}