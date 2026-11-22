package com.daw2.barhub.service;

import com.daw2.barhub.model.dto.TurnoDto;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TurnoService {

    /** Al iniciar sesion: abre un turno si es empleado y no tiene ya uno en curso en otra sesion. */
    void abrirSiCorresponde(Long usuarioId, String username, Collection<String> roles);

    /** El turno en curso del usuario, o vacio si no tiene ninguno. */
    Optional<TurnoDto> actual(Long usuarioId);

    /** "Terminar turno": registra la salida ahora. Lanza IllegalStateException si no hay turno abierto. */
    TurnoDto terminar(Long usuarioId);

    /** Turnos que empiezan entre esas fechas (ambas incluidas, en hora de Madrid), del mas reciente al mas antiguo. */
    List<TurnoDto> listar(LocalDate desde, LocalDate hasta);

    /** Cierra los turnos que ya no tienen ninguna sesion abierta. */
    void cerrarTurnosSinSesion();
}
