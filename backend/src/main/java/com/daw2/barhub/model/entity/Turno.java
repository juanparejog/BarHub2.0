package com.daw2.barhub.model.entity;

import com.daw2.barhub.model.enums.CierreTurno;
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

import java.time.Instant;

/**
 * Turno de trabajo del registro de jornada: se abre cuando un empleado inicia sesion y se cierra
 * con "Terminar turno" o, si no lo pulsa, cuando ya no le queda ninguna sesion abierta.
 */
@Entity
@Table(name = "turnos", indexes = {
        @Index(name = "idx_turnos_usuario", columnList = "id_user"),
        @Index(name = "idx_turnos_entrada", columnList = "entrada")
})
@Getter
@Setter
@NoArgsConstructor
public class Turno {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_user", nullable = false)
    private Long usuarioId;

    /** Copia del nombre de usuario: el registro sigue siendo legible aunque la cuenta cambie o se borre. */
    @Column(nullable = false, length = 50)
    private String username;

    @Column(nullable = false)
    private Instant entrada;

    private Instant salida;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private CierreTurno cierre;
}
