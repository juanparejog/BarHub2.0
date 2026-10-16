package com.daw2.barhub.model.entity;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.Enum.EstadoPago;
import com.daw2.barhub.model.Enum.EstadoPedido;
import com.daw2.barhub.model.Enum.TipoPedido;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.Digits;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Data
@Entity
@Table(name="pedidos")
public class Pedido {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_user", nullable = true)
    @JsonBackReference
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_mesa", nullable = true)
    private Mesa mesa;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pedido", nullable = false)
    private TipoPedido tipoPedido = TipoPedido.MESA;

    @Column(name = "direccion_envio")
    private String direccionEnvio;

    @Column(name = "telefono_contacto")
    private String telefonoContacto;

    @Column
    private Date fecha;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private EstadoPedido estado;

    @Column(precision = 10, scale = 2)
    @Digits(integer = 10, fraction = 2)
    private BigDecimal precioTotal;

    @Column(name = "metodo_pago")
    private String metodoPago;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_pago", nullable = false)
    private EstadoPago estadoPago = EstadoPago.PENDIENTE;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    @JsonProperty("userId")
    public Long getUserId() {
        return (user != null) ? user.getId() : null;
    }

    @JsonProperty("mesaId")
    public Long getMesaId() {
        return (mesa != null) ? mesa.getId() : null;
    }

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<DetallePedido> detalles = new ArrayList<>();
}