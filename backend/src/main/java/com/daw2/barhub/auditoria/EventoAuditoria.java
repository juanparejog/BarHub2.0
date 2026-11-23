package com.daw2.barhub.auditoria;

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
 * Una entrada del registro de auditoria: quien, que, cuando, desde donde y con que resultado.
 * Nunca guarda contrasenas, codigos ni tokens. La aplicacion solo anade entradas: no hay endpoint
 * para cambiarlas ni borrarlas (las antiguas se borran solas, ver AuditoriaService).
 */
@Entity
@Table(name = "auditoria", indexes = {
        @Index(name = "idx_auditoria_fecha", columnList = "fecha"),
        @Index(name = "idx_auditoria_usuario", columnList = "id_user"),
        @Index(name = "idx_auditoria_accion", columnList = "accion")
})
@Getter
@Setter
@NoArgsConstructor
public class EventoAuditoria {

    public static final int LARGO_USUARIO = 50;
    public static final int LARGO_IP = 45;
    public static final int LARGO_OBJETIVO = 100;
    public static final int LARGO_DETALLE = 200;
    public static final int LARGO_PETICION = 160;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant fecha;

    /** Null si no se sabe quien es (login con un usuario que no existe, peticion sin sesion). */
    @Column(name = "id_user")
    private Long usuarioId;

    /** Nombre de usuario en ese momento, o el que se escribio en un login fallido. */
    @Column(length = LARGO_USUARIO)
    private String usuario;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 40)
    private AccionAuditoria accion;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 12)
    private ResultadoAuditoria resultado;

    @Column(length = LARGO_IP)
    private String ip;

    /** Sobre quien o que se hizo, si no es el propio usuario (por ejemplo, "usuario 12 (ana)"). */
    @Column(length = LARGO_OBJETIVO)
    private String objetivo;

    @Column(length = LARGO_DETALLE)
    private String detalle;

    /** Metodo y ruta, por ejemplo "POST /auth/login". */
    @Column(length = LARGO_PETICION)
    private String peticion;
}
