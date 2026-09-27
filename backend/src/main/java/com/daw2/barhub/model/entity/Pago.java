package com.daw2.barhub.model.entity;

import com.daw2.barhub.model.Enum.EstadoPago;
import com.daw2.barhub.model.Enum.MetodoPago;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.Digits;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Data
@Entity
@Table(name="pagos")
public class Pago {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_pedido", nullable = false)
    private Pedido pedido;

    @Enumerated(EnumType.STRING)
    @JsonProperty("metodo_pago")
    @Column(name = "metodo_pago", nullable = false)
    private MetodoPago metodoPago;

    @Enumerated(EnumType.STRING)
    @JsonProperty("estado_pago")
    @Column(name = "estado_pago", nullable = false)
    private EstadoPago estadoPago;

    @Column(precision = 10, scale = 2)
    @Digits(integer = 10, fraction = 2)
    @JsonProperty("total")
    private BigDecimal total;

    @JsonProperty("fecha_pago")
    @Column(name = "fecha_pago")
    private LocalDate fechaPago;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}