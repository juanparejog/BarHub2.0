package com.daw2.barhub.model.enums;

/** Como termino un turno del registro de jornada. */
public enum CierreTurno {
    /** El empleado pulso "Terminar turno". */
    TERMINADO,
    /** Se cerro solo al no quedarle ninguna sesion abierta (cerro sesion, inactividad o duracion maxima). */
    AUTOMATICO
}
