package com.daw2.barhub.model.entity;

import com.daw2.barhub.model.Enum.EstadoMesa;
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
@Table(name="mesas")
public class Mesa {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique=true, nullable=false)
    private String codigoqr;

    @Column(name = "token_qr", unique = true)
    private String tokenQr;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoMesa estado;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}