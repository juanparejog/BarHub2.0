/** Limites de la sesion que devuelve el backend en el login y en cada renovacion. */
export const CLAVE_LIMITES = 'sesion';
/** Ultima interaccion del usuario (compartida entre pestanas). */
export const CLAVE_INTERACCION = 'sesionInteraccion';
/** Ultimo contacto con el servidor que cuenta como actividad (login o renovacion). */
export const CLAVE_CONTACTO = 'sesionContacto';

export interface LimitesSesion {
  caducaEn: number;
  inactividadMs: number;
}

export interface RespuestaSesion {
  token: string;
  sesionCaducaEn?: number;
  sesionInactividadSegundos?: number;
}

/**
 * Guarda los limites de la sesion de una respuesta de login o de renovacion.
 * Con {@code interaccion} tambien apunta que el usuario acaba de actuar (login, "Seguir conectado").
 */
export function guardarLimitesSesion(respuesta: RespuestaSesion, interaccion: boolean, ahora = Date.now()): void {
  if (respuesta.sesionCaducaEn && respuesta.sesionInactividadSegundos) {
    const limites: LimitesSesion = {
      caducaEn: respuesta.sesionCaducaEn,
      inactividadMs: respuesta.sesionInactividadSegundos * 1000
    };
    localStorage.setItem(CLAVE_LIMITES, JSON.stringify(limites));
  }
  localStorage.setItem(CLAVE_CONTACTO, String(ahora));
  if (interaccion) {
    localStorage.setItem(CLAVE_INTERACCION, String(ahora));
  }
}

export function leerLimites(): LimitesSesion | null {
  try {
    const limites = JSON.parse(localStorage.getItem(CLAVE_LIMITES) ?? 'null') as LimitesSesion | null;
    return limites?.caducaEn && limites?.inactividadMs ? limites : null;
  } catch {
    return null;
  }
}
