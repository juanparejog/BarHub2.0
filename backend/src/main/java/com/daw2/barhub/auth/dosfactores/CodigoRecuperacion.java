package com.daw2.barhub.auth.dosfactores;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Codigo de recuperacion de un solo uso, para entrar sin el movil. Solo se guarda su HMAC. */
@Entity
@Table(name = "codigos_recuperacion", indexes = {
        @Index(name = "idx_codigos_recuperacion_usuario", columnList = "id_user, huella")
})
@Getter
@Setter
@NoArgsConstructor
public class CodigoRecuperacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_user", nullable = false)
    private Long usuarioId;

    @Column(nullable = false, length = 64)
    private String huella;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(name = "usado_en")
    private Instant usadoEn;
}
