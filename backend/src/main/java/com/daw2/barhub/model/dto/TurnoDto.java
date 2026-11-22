package com.daw2.barhub.model.dto;

import com.daw2.barhub.model.entity.Turno;

import java.time.Duration;
import java.time.Instant;

/**
 * Turno del registro de jornada. Las horas van en milisegundos desde 1970 (sin ambiguedad de zona);
 * {@code salida} y {@code cierre} son null mientras el turno sigue abierto.
 */
public record TurnoDto(Long id, Long usuarioId, String username, Long entrada, Long salida,
                       long duracionMinutos, String cierre) {

    public static TurnoDto from(Turno turno, Instant ahora) {
        Instant fin = turno.getSalida() != null ? turno.getSalida() : ahora;
        return new TurnoDto(
                turno.getId(),
                turno.getUsuarioId(),
                turno.getUsername(),
                turno.getEntrada().toEpochMilli(),
                turno.getSalida() != null ? turno.getSalida().toEpochMilli() : null,
                Math.max(0, Duration.between(turno.getEntrada(), fin).toMinutes()),
                turno.getCierre() != null ? turno.getCierre().name() : null);
    }
}
