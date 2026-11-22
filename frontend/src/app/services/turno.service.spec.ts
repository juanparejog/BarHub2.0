import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { DialogService } from '../main/services/shared/services/dialog.service';
import { Turno, TurnoService, duracionTurno } from './turno.service';

describe('TurnoService', () => {
  let servicio: TurnoService;
  let backend: HttpTestingController;
  const logout = vi.fn();
  const solicitarConfirmacion = vi.fn();
  const mostrarToast = vi.fn();

  const turno = (salida: number | null = null): Turno => ({
    id: 1, usuarioId: 5, username: 'lucia',
    entrada: Date.parse('2026-11-22T08:00:00Z'), salida,
    duracionMinutos: 465, cierre: salida ? 'TERMINADO' : null
  });

  beforeEach(() => {
    [logout, solicitarConfirmacion, mostrarToast].forEach(f => f.mockReset());
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { logout } },
        { provide: DialogService, useValue: { solicitarConfirmacion, mostrarToast } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    servicio = TestBed.inject(TurnoService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('sin turno en curso el backend responde 204 y llega null', () => {
    let resultado: Turno | null | undefined;
    servicio.actual().subscribe(t => (resultado = t));
    backend.expectOne(r => r.url.endsWith('/turnos/actual')).flush(null, { status: 204, statusText: 'No Content' });
    expect(resultado).toBeNull();
  });

  it('el listado pide el rango de fechas', () => {
    servicio.listar('2026-11-16', '2026-11-22').subscribe();
    const peticion = backend.expectOne(r => r.url.endsWith('/turnos'));
    expect(peticion.request.params.get('desde')).toBe('2026-11-16');
    expect(peticion.request.params.get('hasta')).toBe('2026-11-22');
    peticion.flush([]);
  });

  it('terminar turno pide confirmación con la hora de entrada y, al aceptar, ficha la salida y cierra sesión', () => {
    solicitarConfirmacion.mockImplementation((_mensaje: string, _titulo: string, accion: () => void) => accion());

    servicio.pedirFinDeTurno();
    backend.expectOne(r => r.url.endsWith('/turnos/actual')).flush(turno());

    const [mensaje, titulo] = solicitarConfirmacion.mock.calls[0];
    expect(titulo).toBe('Terminar turno');
    expect(mensaje).toContain('Entraste a las');
    expect(mensaje).toContain('7 h 45 min');

    const terminar = backend.expectOne(r => r.url.endsWith('/turnos/terminar'));
    expect(terminar.request.method).toBe('POST');
    terminar.flush(turno(Date.parse('2026-11-22T15:45:00Z')));

    expect(mostrarToast).toHaveBeenCalledWith(expect.stringContaining('Turno terminado a las'));
    expect(logout).toHaveBeenCalled();
  });

  it('si cancela la confirmación no ficha ni cierra sesión', () => {
    servicio.pedirFinDeTurno();
    backend.expectOne(r => r.url.endsWith('/turnos/actual')).flush(null, { status: 204, statusText: 'No Content' });

    expect(solicitarConfirmacion).toHaveBeenCalled();
    expect(solicitarConfirmacion.mock.calls[0][0]).not.toContain('Entraste');
    backend.expectNone(r => r.url.endsWith('/turnos/terminar'));
    expect(logout).not.toHaveBeenCalled();
  });

  it('si el fichaje falla avisa y no cierra la sesión', () => {
    solicitarConfirmacion.mockImplementation((_m: string, _t: string, accion: () => void) => accion());
    servicio.pedirFinDeTurno();
    backend.expectOne(r => r.url.endsWith('/turnos/actual')).flush(turno());
    backend.expectOne(r => r.url.endsWith('/turnos/terminar')).flush(null, { status: 409, statusText: 'Conflict' });

    expect(mostrarToast).toHaveBeenCalledWith(expect.stringContaining('No se pudo registrar'));
    expect(logout).not.toHaveBeenCalled();
  });

  it('si no se puede consultar el turno, avisa', () => {
    servicio.pedirFinDeTurno();
    backend.expectOne(r => r.url.endsWith('/turnos/actual')).flush(null, { status: 500, statusText: 'Error' });
    expect(mostrarToast).toHaveBeenCalledWith(expect.stringContaining('No se pudo consultar'));
    expect(solicitarConfirmacion).not.toHaveBeenCalled();
  });

  it('la duración se escribe en horas y minutos', () => {
    expect(duracionTurno(45)).toBe('45 min');
    expect(duracionTurno(60)).toBe('1 h 0 min');
    expect(duracionTurno(465)).toBe('7 h 45 min');
  });
});
