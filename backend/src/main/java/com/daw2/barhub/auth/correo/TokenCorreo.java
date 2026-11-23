package com.daw2.barhub.auth.correo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Enlace de un solo uso enviado por correo (confirmar la cuenta, restablecer la contrasena o
 * confirmar un correo nuevo).
 * Solo se guarda el SHA-256 del token: con una copia de la base de datos no se puede usar ninguno.
 */
@Entity
@Table(name = "tokens_correo", indexes = {
        @Index(name = "idx_tokens_correo_hash", columnList = "token_hash", unique = true),
        @Index(name = "idx_tokens_correo_usuario", columnList = "id_user")
})
@Getter
@Setter
@NoArgsConstructor
public class TokenCorreo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_user", nullable = false)
    private Long usuarioId;

    /**
     * VARCHAR y no el ENUM nativo que Hibernate crea en MariaDB: con ENUM, cada tipo nuevo exige
     * cambiar la columna a mano (ddl-auto: update no modifica columnas existentes).
     */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private TipoTokenCorreo tipo;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private Instant creado;

    @Column(name = "caduca_en", nullable = false)
    private Instant caducaEn;

    /** Solo en CAMBIO_CORREO: el correo que pasara a tener la cuenta al confirmar. */
    @Column(name = "nuevo_email", length = 150)
    private String nuevoEmail;

    /** Usado o anulado por uno mas nuevo: ya no sirve. */
    @Column(name = "usado_en")
    private Instant usadoEn;

    public boolean valido(Instant ahora) {
        return usadoEn == null && ahora.isBefore(caducaEn);
    }
}
