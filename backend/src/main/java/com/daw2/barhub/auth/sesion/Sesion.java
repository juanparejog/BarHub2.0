package com.daw2.barhub.auth.sesion;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Sesion abierta en el servidor. El token de acceso (JWT) lleva su id en el claim {@code sid}, asi
 * que cerrar o caducar la sesion invalida tambien los tokens de acceso ya emitidos.
 *
 * <p>Del token de renovacion solo se guarda su SHA-256: con una copia de la base de datos no se
 * puede renovar ninguna sesion. Se guarda tambien el hash del token anterior a la ultima rotacion
 * para detectar su reutilizacion (senal de robo) y revocar la sesion entera.
 */
@Entity
@Table(name = "sesiones", indexes = {
        @Index(name = "idx_sesiones_token", columnList = "token_hash", unique = true),
        @Index(name = "idx_sesiones_token_anterior", columnList = "token_anterior_hash"),
        @Index(name = "idx_sesiones_usuario", columnList = "id_user")
})
@Getter
@Setter
@NoArgsConstructor
public class Sesion {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "id_user", nullable = false)
    private Long usuarioId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "token_anterior_hash", length = 64)
    private String tokenAnteriorHash;

    @Column(name = "rotado_en")
    private Instant rotadoEn;

    @Column(nullable = false)
    private Instant creada;

    @Column(name = "ultima_actividad", nullable = false)
    private Instant ultimaActividad;

    @Column(name = "inactividad_segundos", nullable = false)
    private long inactividadSegundos;

    @Column(name = "caduca_en", nullable = false)
    private Instant caducaEn;

    @Column(name = "revocada_en")
    private Instant revocadaEn;

    @Column(name = "motivo_revocacion", length = 20)
    private String motivoRevocacion;

    @Column(length = 45)
    private String ip;

    @Column(length = 255)
    private String agente;

    /** Abierta, sin pasar la duracion maxima y sin pasar el limite de inactividad. */
    public boolean vigente(Instant ahora) {
        return revocadaEn == null
                && ahora.isBefore(caducaEn)
                && !ahora.isAfter(ultimaActividad.plusSeconds(inactividadSegundos));
    }
}
