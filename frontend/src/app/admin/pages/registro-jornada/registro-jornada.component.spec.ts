import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Turno, TurnoService } from '../../../services/turno.service';
import { RegistroJornadaComponent } from './registro-jornada.component';

describe('RegistroJornadaComponent', () => {
  const listar = vi.fn();

  const turno = (id: number, username: string, minutos: number, salida: number | null, cierre: Turno['cierre']): Turno => ({
    id, usuarioId: id, username, entrada: Date.parse('2026-11-22T08:00:00Z'), salida, duracionMinutos: minutos, cierre
  });

  function crear() {
    TestBed.configureTestingModule({
      imports: [RegistroJornadaComponent],
      providers: [{ provide: TurnoService, useValue: { listar } }]
    });
    const fixture = TestBed.createComponent(RegistroJornadaComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => listar.mockReset());

  it('al abrir pide los últimos 7 días', () => {
    listar.mockReturnValue(of([]));
    const fixture = crear();
    const [desde, hasta] = listar.mock.calls[0];
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
    expect(dias).toBe(6);
    expect(fixture.componentInstance.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pinta los turnos, su estado y las horas por empleado', () => {
    const salida = Date.parse('2026-11-22T15:45:00Z');
    listar.mockReturnValue(of([
      turno(3, 'lucia', 30, null, null),
      turno(2, 'lucia', 465, salida, 'TERMINADO'),
      turno(1, 'pablo', 120, salida, 'AUTOMATICO')
    ]));
    const raiz = crear().nativeElement as HTMLElement;

    const filas = Array.from(raiz.querySelectorAll('tbody tr'));
    expect(filas.length).toBe(3);
    expect(filas[0].textContent).toContain('En curso');
    expect(filas[1].textContent).toContain('Terminado');
    expect(filas[1].textContent).toContain('7 h 45 min');
    expect(filas[2].textContent).toContain('Cerrado sin fichar');

    // Nombre, horas y turnos van en elementos separados: se juntan con un espacio para compararlos
    const resumen = Array.from(raiz.querySelectorAll('.resumen-empleado .resumen-datos')).map(datos =>
      Array.from(datos.children).map(e => e.textContent?.replace(/\s+/g, ' ').trim()).join(' '));
    expect(resumen).toEqual(['lucia 8 h 15 min en 2 turnos', 'pablo 2 h 0 min en 1 turno']);
    expect(raiz.querySelector('.jornada-total strong')?.textContent).toBe('10 h 15 min');
  });

  it('pulsar un empleado deja solo sus turnos y pulsarlo otra vez los enseña todos', () => {
    const salida = Date.parse('2026-11-22T15:45:00Z');
    listar.mockReturnValue(of([
      turno(3, 'lucia', 30, null, null),
      turno(2, 'lucia', 465, salida, 'TERMINADO'),
      turno(1, 'pablo', 120, salida, 'AUTOMATICO')
    ]));
    const fixture = crear();
    const raiz = fixture.nativeElement as HTMLElement;
    const pablo = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.resumen-empleado')).find(b => b.textContent?.includes('pablo'))!;

    pablo.click();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('tbody tr').length).toBe(1);
    expect(pablo.getAttribute('aria-pressed')).toBe('true');

    pablo.click();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('los rangos rápidos cambian las fechas y consultan', () => {
    listar.mockReturnValue(of([]));
    const fixture = crear();
    const hoy = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.trim() === 'Hoy')!;
    hoy.click();
    const [desde, hasta] = listar.mock.lastCall!;
    expect(desde).toBe(hasta);
    expect(fixture.componentInstance.dias).toBe(1);
  });

  it('sin turnos lo dice', () => {
    listar.mockReturnValue(of([]));
    const raiz = crear().nativeElement as HTMLElement;
    expect(raiz.querySelector('tbody')?.textContent).toContain('No hay turnos en estas fechas.');
  });

  it('si el backend rechaza el rango muestra su motivo', () => {
    listar.mockReturnValue(throwError(() => ({ error: { message: 'Rango de fechas no válido' } })));
    const fixture = crear();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Rango de fechas no válido');
    expect(fixture.componentInstance.turnos).toEqual([]);
  });

  it('si falla sin motivo muestra un aviso general', () => {
    listar.mockReturnValue(throwError(() => new Error('red')));
    const fixture = crear();
    expect(fixture.componentInstance.error).toBe('No se pudo cargar el registro de jornada.');
  });

  it('consultar vuelve a pedir con las fechas elegidas', () => {
    listar.mockReturnValue(of([]));
    const fixture = crear();
    fixture.componentInstance.desde = '2026-11-01';
    fixture.componentInstance.hasta = '2026-11-15';
    fixture.componentInstance.cargar();
    expect(listar).toHaveBeenLastCalledWith('2026-11-01', '2026-11-15');
  });
});
