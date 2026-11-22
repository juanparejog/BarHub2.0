import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { AVISO_FIN_MS, AVISO_INACTIVIDAD_MS, SesionAvisoService } from './sesion-aviso.service';
import { CLAVE_CONTACTO, CLAVE_INTERACCION, CLAVE_LIMITES, guardarLimitesSesion } from './sesion-limites';

const AHORA = Date.parse('2026-11-22T10:00:00Z');
const MINUTO = 60_000;

describe('SesionAvisoService', () => {
  let servicio: SesionAvisoService;
  let backend: HttpTestingController;
  const logout = vi.fn();

  /** Sesion de administrador: 15 minutos de inactividad y final dentro de 8 horas. */
  function sesion(inactividadMs = 15 * MINUTO, caducaEn = AHORA + 8 * 60 * MINUTO): void {
    localStorage.setItem('token', 'abc.def.ghi');
    localStorage.setItem(CLAVE_LIMITES, JSON.stringify({ caducaEn, inactividadMs }));
    localStorage.setItem(CLAVE_INTERACCION, String(AHORA));
    localStorage.setItem(CLAVE_CONTACTO, String(AHORA));
  }

  beforeEach(() => {
    localStorage.clear();
    logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { logout } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    servicio = TestBed.inject(SesionAvisoService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    servicio.detener();
    backend.verify();
    vi.useRealTimers();
  });

  it('sin sesión no avisa', () => {
    servicio.comprobar(AHORA);
    expect(servicio.estado()).toBe('ninguno');
  });

  it('con actividad reciente no avisa', () => {
    sesion();
    servicio.comprobar(AHORA + 5 * MINUTO);
    expect(servicio.estado()).toBe('ninguno');
  });

  it('dos minutos antes del cierre por inactividad pregunta si sigues ahí, con cuenta atrás', () => {
    sesion();
    servicio.comprobar(AHORA + 15 * MINUTO - AVISO_INACTIVIDAD_MS);
    expect(servicio.estado()).toBe('inactividad');
    expect(servicio.texto()).toBe('2:00');

    servicio.comprobar(AHORA + 15 * MINUTO - 65_000);
    expect(servicio.texto()).toBe('1:05');
  });

  it('la actividad en otra pestaña quita el aviso', () => {
    sesion();
    servicio.comprobar(AHORA + 14 * MINUTO);
    expect(servicio.estado()).toBe('inactividad');

    localStorage.setItem(CLAVE_INTERACCION, String(AHORA + 14 * MINUTO));
    servicio.comprobar(AHORA + 14 * MINUTO + 1000);
    expect(servicio.estado()).toBe('ninguno');
  });

  it('si nadie responde, cierra la sesión con el aviso de caducada', () => {
    sesion();
    servicio.comprobar(AHORA + 15 * MINUTO);
    expect(logout).toHaveBeenCalledWith('caducada');
    expect(servicio.estado()).toBe('ninguno');
  });

  it('al llegar a la duración máxima cierra la sesión aunque haya actividad', () => {
    sesion(15 * MINUTO, AHORA + 10 * MINUTO);
    localStorage.setItem(CLAVE_INTERACCION, String(AHORA + 9 * MINUTO));
    servicio.comprobar(AHORA + 10 * MINUTO);
    expect(logout).toHaveBeenCalledWith('caducada');
  });

  it('cinco minutos antes de la duración máxima avisa de la hora de cierre, y se puede descartar', () => {
    sesion(60 * MINUTO, AHORA + 30 * MINUTO);
    localStorage.setItem(CLAVE_INTERACCION, String(AHORA + 25 * MINUTO));
    servicio.comprobar(AHORA + 30 * MINUTO - AVISO_FIN_MS);
    expect(servicio.estado()).toBe('fin-proximo');
    expect(servicio.texto()).toMatch(/^\d{2}:\d{2}$/);

    servicio.descartarAvisoDeFin();
    servicio.comprobar(AHORA + 27 * MINUTO);
    expect(servicio.estado()).toBe('ninguno');
  });

  it('"Seguir conectado" apunta la interacción y renueva la sesión en el servidor', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA + 14 * MINUTO);
    sesion();
    servicio.comprobar(AHORA + 14 * MINUTO);
    servicio.seguirConectado();

    expect(servicio.estado()).toBe('ninguno');
    expect(Number(localStorage.getItem(CLAVE_INTERACCION))).toBe(AHORA + 14 * MINUTO);
    const renovacion = backend.expectOne(r => r.url.endsWith('/auth/refresh'));
    expect(renovacion.request.withCredentials).toBe(true);
    renovacion.flush({ token: 'nuevo', sesionCaducaEn: AHORA + 8 * 60 * MINUTO, sesionInactividadSegundos: 900 });
    expect(localStorage.getItem('token')).toBe('nuevo');
  });

  it('si la renovación falla no rompe nada: el temporizador cerrará la sesión', () => {
    sesion();
    servicio.seguirConectado();
    backend.expectOne(r => r.url.endsWith('/auth/refresh')).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBe('abc.def.ghi');
  });

  it('"Cerrar sesión" en el aviso cierra la sesión normal', () => {
    sesion();
    servicio.cerrarSesion();
    expect(logout).toHaveBeenCalledWith();
  });

  it('la interacción del usuario cuenta y, si el servidor lleva tiempo sin saber de él, renueva', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA + 10 * MINUTO);
    sesion();
    servicio.iniciar();

    document.dispatchEvent(new Event('click'));

    expect(Number(localStorage.getItem(CLAVE_INTERACCION))).toBe(AHORA + 10 * MINUTO);
    backend.expectOne(r => r.url.endsWith('/auth/refresh')).flush({ token: 'nuevo' });
  });

  it('con contacto reciente con el servidor la interacción no renueva', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA + MINUTO);
    sesion();
    servicio.iniciar();
    servicio.iniciar();

    document.dispatchEvent(new Event('keydown'));

    expect(Number(localStorage.getItem(CLAVE_INTERACCION))).toBe(AHORA + MINUTO);
    backend.expectNone(r => r.url.endsWith('/auth/refresh'));
  });

  it('con el aviso abierto, mover el ratón no cuenta: hay que pulsar "Seguir conectado"', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA + 14 * MINUTO);
    sesion();
    servicio.comprobar(AHORA + 14 * MINUTO);
    servicio.iniciar();

    document.dispatchEvent(new Event('mousemove'));

    expect(Number(localStorage.getItem(CLAVE_INTERACCION))).toBe(AHORA);
  });
});

describe('guardarLimitesSesion', () => {
  beforeEach(() => localStorage.clear());

  it('guarda los límites y el contacto; la interacción solo si el usuario ha actuado', () => {
    guardarLimitesSesion({ token: 't', sesionCaducaEn: AHORA + MINUTO, sesionInactividadSegundos: 900 }, false, AHORA);

    expect(JSON.parse(localStorage.getItem(CLAVE_LIMITES)!)).toEqual({ caducaEn: AHORA + MINUTO, inactividadMs: 900_000 });
    expect(localStorage.getItem(CLAVE_CONTACTO)).toBe(String(AHORA));
    expect(localStorage.getItem(CLAVE_INTERACCION)).toBeNull();

    guardarLimitesSesion({ token: 't' }, true, AHORA + 5);
    expect(localStorage.getItem(CLAVE_INTERACCION)).toBe(String(AHORA + 5));
  });

  it('unos límites dañados en el almacenamiento se ignoran', () => {
    localStorage.setItem('token', 'abc');
    localStorage.setItem(CLAVE_LIMITES, '{roto');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { logout: vi.fn() } }, provideHttpClient(), provideHttpClientTesting()]
    });
    const servicio = TestBed.inject(SesionAvisoService);
    servicio.comprobar(AHORA);
    expect(servicio.estado()).toBe('ninguno');
  });
});
