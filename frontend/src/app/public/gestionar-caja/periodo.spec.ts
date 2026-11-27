import { enPeriodo, esElActual, etiquetaPeriodo, moverReferencia, periodoDe } from './periodo';

describe('Periodos del historial de caja', () => {
  // Jueves 26 de noviembre de 2026, a media tarde
  const jueves = new Date(2026, 10, 26, 17, 30);

  it('la semana va de lunes a domingo, aunque la referencia sea domingo', () => {
    const semana = periodoDe('semana', jueves);
    expect(semana.desde).toEqual(new Date(2026, 10, 23));
    expect(semana.hasta).toEqual(new Date(2026, 10, 30));
    expect(periodoDe('semana', new Date(2026, 10, 29, 23, 0)).desde).toEqual(new Date(2026, 10, 23));
    expect(etiquetaPeriodo(semana)).toBe('23 nov – 29 nov 2026');
  });

  it('mes y año completos, y «todo» sin límites', () => {
    const mes = periodoDe('mes', jueves);
    expect(mes.desde).toEqual(new Date(2026, 10, 1));
    expect(mes.hasta).toEqual(new Date(2026, 11, 1));
    expect(etiquetaPeriodo(mes)).toBe('Noviembre de 2026');
    expect(etiquetaPeriodo(periodoDe('anio', jueves))).toBe('2026');
    expect(etiquetaPeriodo(periodoDe('todo', jueves))).toBe('Todo el historial');
  });

  it('se mueve hacia atrás y hacia delante sin saltarse meses', () => {
    expect(periodoDe('semana', moverReferencia('semana', jueves, -1)).desde).toEqual(new Date(2026, 10, 16));
    expect(periodoDe('mes', moverReferencia('mes', new Date(2026, 0, 31), 1)).desde).toEqual(new Date(2026, 1, 1));
    expect(periodoDe('anio', moverReferencia('anio', jueves, -1)).desde).toEqual(new Date(2025, 0, 1));
  });

  it('cuenta lo que se abrió dentro del periodo, con el final sin incluir', () => {
    const semana = periodoDe('semana', jueves);
    expect(enPeriodo(new Date(2026, 10, 23, 0, 0).toISOString(), semana)).toBe(true);
    expect(enPeriodo(new Date(2026, 10, 30, 0, 0).toISOString(), semana)).toBe(false);
    expect(enPeriodo(null, semana)).toBe(false);
    expect(enPeriodo(null, periodoDe('todo', jueves))).toBe(true);
  });

  it('el periodo de hoy es el actual; el anterior, no', () => {
    expect(esElActual(periodoDe('semana', jueves), jueves)).toBe(true);
    expect(esElActual(periodoDe('semana', moverReferencia('semana', jueves, -1)), jueves)).toBe(false);
  });
});
