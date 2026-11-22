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

    const resumen = Array.from(raiz.querySelectorAll('.resumen-empleado')).map(e => e.textContent?.replace(/\s+/g, ' ').trim());
    expect(resumen).toEqual(['lucia: 8 h 15 min en 2 turnos', 'pablo: 2 h 0 min en 1 turno']);
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
