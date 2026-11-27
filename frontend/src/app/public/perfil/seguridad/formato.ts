import { type Idioma, localeDe } from '../../../shared/i18n/idiomas';
import { traducir } from '../../../shared/i18n/textos';

/** Descripción corta de un navegador a partir de su User-Agent: «Firefox en Linux», «Chrome en Android»... */
export function describirNavegador(agente: string | null | undefined, idioma: Idioma = 'es'): string {
  if (!agente) {
    return traducir(idioma, 'sesiones.desconocido');
  }
  const navegador =
    /Edg\//.test(agente) ? 'Edge'
      : /OPR\/|Opera/.test(agente) ? 'Opera'
        : /Firefox\//.test(agente) ? 'Firefox'
          : /Chrome\/|CriOS/.test(agente) ? 'Chrome'
            : /Safari\//.test(agente) ? 'Safari'
              : traducir(idioma, 'sesiones.navegador');
  const sistema =
    /Android/.test(agente) ? 'Android'
      : /iPhone|iPad|iPod/.test(agente) ? 'iOS'
        : /Windows/.test(agente) ? 'Windows'
          : /Mac OS X|Macintosh/.test(agente) ? 'macOS'
            : /Linux/.test(agente) ? 'Linux'
              : '';
  return sistema ? traducir(idioma, 'sesiones.en', { navegador, sistema }) : navegador;
}

/** Si el User-Agent es de un móvil o una tableta (para elegir el icono). */
export function esMovil(agente: string | null | undefined): boolean {
  return !!agente && /Android|iPhone|iPad|iPod|Mobile/.test(agente);
}

/** «ahora mismo», «hace 5 minutos», «hace 2 horas», «hace 3 días». */
export function haceCuanto(instante: number, ahora: number = Date.now(), idioma: Idioma = 'es'): string {
  const minutos = Math.floor(Math.max(0, ahora - instante) / 60_000);
  if (minutos < 1) {
    return traducir(idioma, 'sesiones.ahora');
  }
  if (minutos < 60) {
    return traducir(idioma, minutos === 1 ? 'sesiones.minuto' : 'sesiones.minutos', { n: minutos });
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return traducir(idioma, horas === 1 ? 'sesiones.hora' : 'sesiones.horas', { n: horas });
  }
  const dias = Math.floor(horas / 24);
  return traducir(idioma, dias === 1 ? 'sesiones.dia' : 'sesiones.dias', { n: dias });
}

/** Fecha y hora cortas: «23/11/2026, 12:04» en español. */
export function fechaHora(instante: number, idioma: Idioma = 'es'): string {
  return new Intl.DateTimeFormat(localeDe(idioma), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(instante));
}
