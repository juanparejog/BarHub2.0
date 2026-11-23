/** Descripción corta de un navegador a partir de su User-Agent: «Firefox en Linux», «Chrome en Android»... */
export function describirNavegador(agente: string | null | undefined): string {
  if (!agente) {
    return 'Navegador desconocido';
  }
  const navegador =
    /Edg\//.test(agente) ? 'Edge'
      : /OPR\/|Opera/.test(agente) ? 'Opera'
        : /Firefox\//.test(agente) ? 'Firefox'
          : /Chrome\/|CriOS/.test(agente) ? 'Chrome'
            : /Safari\//.test(agente) ? 'Safari'
              : 'Navegador';
  const sistema =
    /Android/.test(agente) ? 'Android'
      : /iPhone|iPad|iPod/.test(agente) ? 'iOS'
        : /Windows/.test(agente) ? 'Windows'
          : /Mac OS X|Macintosh/.test(agente) ? 'macOS'
            : /Linux/.test(agente) ? 'Linux'
              : '';
  return sistema ? `${navegador} en ${sistema}` : navegador;
}

/** Si el User-Agent es de un móvil o una tableta (para elegir el icono). */
export function esMovil(agente: string | null | undefined): boolean {
  return !!agente && /Android|iPhone|iPad|iPod|Mobile/.test(agente);
}

/** «ahora mismo», «hace 5 minutos», «hace 2 horas», «hace 3 días». */
export function haceCuanto(instante: number, ahora: number = Date.now()): string {
  const minutos = Math.floor(Math.max(0, ahora - instante) / 60_000);
  if (minutos < 1) {
    return 'ahora mismo';
  }
  if (minutos < 60) {
    return minutos === 1 ? 'hace 1 minuto' : `hace ${minutos} minutos`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  }
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/** Fecha y hora cortas en español: «23/11/2026, 12:04». */
export function fechaHora(instante: number): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(instante));
}
