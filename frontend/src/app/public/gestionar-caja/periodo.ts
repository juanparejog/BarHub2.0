/** Periodos del historial de caja: una semana (de lunes a domingo), un mes, un año o todo. */
export type TipoPeriodo = 'semana' | 'mes' | 'anio' | 'todo';

/** Desde (incluido) y hasta (sin incluir), en hora local. Sin límites para «todo». */
export interface Periodo {
  tipo: TipoPeriodo;
  desde: Date | null;
  hasta: Date | null;
}

/** El periodo de ese tipo que contiene la fecha de referencia. */
export function periodoDe(tipo: TipoPeriodo, referencia: Date): Periodo {
  const dia = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  switch (tipo) {
    case 'semana': {
      // getDay(): 0 es domingo; la semana empieza el lunes
      const desde = new Date(dia);
      desde.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
      const hasta = new Date(desde);
      hasta.setDate(desde.getDate() + 7);
      return { tipo, desde, hasta };
    }
    case 'mes':
      return { tipo, desde: new Date(dia.getFullYear(), dia.getMonth(), 1), hasta: new Date(dia.getFullYear(), dia.getMonth() + 1, 1) };
    case 'anio':
      return { tipo, desde: new Date(dia.getFullYear(), 0, 1), hasta: new Date(dia.getFullYear() + 1, 0, 1) };
    default:
      return { tipo: 'todo', desde: null, hasta: null };
  }
}

/** La referencia movida tantos periodos adelante (positivo) o atrás (negativo). */
export function moverReferencia(tipo: TipoPeriodo, referencia: Date, pasos: number): Date {
  const nueva = new Date(referencia);
  if (tipo === 'semana') {
    nueva.setDate(nueva.getDate() + 7 * pasos);
  } else if (tipo === 'mes') {
    // Día 1 para que del 31 de enero no se salte a marzo
    nueva.setDate(1);
    nueva.setMonth(nueva.getMonth() + pasos);
  } else if (tipo === 'anio') {
    nueva.setFullYear(nueva.getFullYear() + pasos);
  }
  return nueva;
}

export function enPeriodo(fecha: string | number | Date | null | undefined, periodo: Periodo): boolean {
  if (periodo.desde === null || periodo.hasta === null) {
    return true;
  }
  if (fecha === null || fecha === undefined || fecha === '') {
    return false;
  }
  const momento = new Date(fecha).getTime();
  return momento >= periodo.desde.getTime() && momento < periodo.hasta.getTime();
}

/** Etiqueta del periodo: «23 nov – 29 nov 2026», «Noviembre de 2026», «2026» o, sin límites, el historial completo. */
export function etiquetaPeriodo(periodo: Periodo): string {
  if (periodo.desde === null || periodo.hasta === null) {
    return 'Todo el historial';
  }
  const desde = periodo.desde;
  if (periodo.tipo === 'anio') {
    return String(desde.getFullYear());
  }
  if (periodo.tipo === 'mes') {
    const texto = desde.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const ultimo = new Date(periodo.hasta);
  ultimo.setDate(ultimo.getDate() - 1);
  const corto = (fecha: Date, conAnio: boolean) =>
    fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) }).replace('.', '');
  return `${corto(desde, desde.getFullYear() !== ultimo.getFullYear())} – ${corto(ultimo, true)}`;
}

/** Si el periodo siguiente ya empezaría después de hoy (no hay nada que ver en el futuro). */
export function esElActual(periodo: Periodo, hoy: Date): boolean {
  return periodo.hasta === null || periodo.hasta.getTime() > hoy.getTime();
}
