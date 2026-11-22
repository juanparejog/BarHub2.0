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

/**
 * Verificacion en dos pasos (TOTP) de un usuario. Mientras no esta activa, el secreto es el de una
 * configuracion a medias: se sustituye si el usuario vuelve a empezar.
 */
@Entity
@Table(name = "segundo_factor", indexes = {
        @Index(name = "idx_segundo_factor_usuario", columnList = "id_user", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
public class SegundoFactor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_user", nullable = false)
    private Long usuarioId;

    /** Secreto TOTP cifrado con AES-GCM (ver CifradoDosFactores). */
    @Column(name = "secreto_cifrado", nullable = false, length = 200)
    private String secretoCifrado;

    @Column(nullable = false)
    private boolean activo;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(name = "activado_en")
    private Instant activadoEn;

    /** Ultimo paso de 30 segundos cuyo codigo se ha aceptado: ese codigo y los anteriores ya no valen. */
    @Column(name = "ultimo_paso")
    private Long ultimoPaso;
}
