import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthInterceptor } from './auth.interceptor';
import { ReautenticacionService } from './reautenticacion.service';

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const navigate = vi.fn(() => Promise.resolve(true));

  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: Router, useValue: { navigate } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('añade la cabecera Authorization cuando hay token', () => {
    localStorage.setItem('token', 'abc.def.ghi');
    http.get('/api/pedidos').subscribe();
    const peticion = backend.expectOne('/api/pedidos');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
    peticion.flush([]);
  });

  it('no añade cabecera cuando no hay sesión', () => {
    http.get('/api/carta').subscribe();
    const peticion = backend.expectOne('/api/carta');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush([]);
  });

  it('ante un 401 renueva el token con la cookie y repite la petición', () => {
    localStorage.setItem('token', 'caducado');
    let respuesta: unknown;
    http.get('/api/pedidos').subscribe(r => (respuesta = r));

    backend.expectOne('/api/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });
    const renovacion = backend.expectOne(r => r.url.endsWith('/auth/refresh'));
    expect(renovacion.request.method).toBe('POST');
    expect(renovacion.request.withCredentials).toBe(true);
    renovacion.flush({ token: 'nuevo' });

    const repetida = backend.expectOne('/api/pedidos');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer nuevo');
    repetida.flush([{ id: 1 }]);

    expect(respuesta).toEqual([{ id: 1 }]);
    expect(localStorage.getItem('token')).toBe('nuevo');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('varias peticiones caducadas a la vez comparten una sola renovación', () => {
    localStorage.setItem('token', 'caducado');
    http.get('/api/pedidos').subscribe();
    http.get('/api/mesas').subscribe();

    backend.expectOne('/api/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/mesas').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(r => r.url.endsWith('/auth/refresh')).flush({ token: 'nuevo' });

    backend.expectOne('/api/pedidos').flush([]);
    backend.expectOne('/api/mesas').flush([]);
    expect(localStorage.getItem('token')).toBe('nuevo');
  });

  it('si la renovación falla borra toda la sesión y manda al login con el aviso', () => {
    localStorage.setItem('token', 'caducado');
    localStorage.setItem('roles', '["ROLE_CLIENTE"]');
    localStorage.setItem('user', '{"id":7,"username":"ana"}');
    localStorage.setItem('theme', 'dark');

    let estado = 0;
    http.get('/api/pedidos').subscribe({ error: err => (estado = err.status) });
    backend.expectOne('/api/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(r => r.url.endsWith('/auth/refresh')).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(estado).toBe(401);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('roles')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { sesion: 'caducada' } });
  });

  it('sin sesión iniciada un 401 no intenta renovar', () => {
    http.get('/api/pedidos').subscribe({ error: () => undefined });
    backend.expectOne('/api/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectNone(r => r.url.endsWith('/auth/refresh'));
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('un 401 del propio login no redirige: son credenciales incorrectas', () => {
    let estado = 0;
    http.post('/api/auth/login', { username: 'ana', password: 'mala' }).subscribe({ error: err => (estado = err.status) });
    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(estado).toBe(401);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un 401 de la propia renovación no vuelve a renovar', () => {
    localStorage.setItem('token', 'caducado');
    http.post('/api/auth/refresh', null).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectNone(r => r.url.endsWith('/auth/refresh'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ante otros errores conserva la sesión', () => {
    localStorage.setItem('token', 'valido');
    http.get('/api/pedidos').subscribe({ error: () => undefined });
    backend.expectOne('/api/pedidos').flush(null, { status: 500, statusText: 'Server Error' });

    expect(localStorage.getItem('token')).toBe('valido');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('AuthInterceptor: acciones que piden reautenticación', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let respuesta: Subject<boolean>;
  const pedir = vi.fn();
  const REQUERIDA = { code: 'REAUTENTICACION_REQUERIDA', metodo: 'codigo', message: 'Escribe el código.' };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'valido');
    respuesta = new Subject<boolean>();
    pedir.mockReset();
    pedir.mockReturnValue(respuesta);
    TestBed.configureTestingModule({
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ReautenticacionService, useValue: { pedir } },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('ante un 403 REAUTENTICACION_REQUERIDA pide el código y, confirmado, repite la petición', () => {
    let resultado: unknown;
    http.delete('/api/usuarios/7').subscribe(r => (resultado = r));
    backend.expectOne('/api/usuarios/7').flush(REQUERIDA, { status: 403, statusText: 'Forbidden' });
    expect(pedir).toHaveBeenCalledWith('codigo');

    respuesta.next(true);
    const repetida = backend.expectOne('/api/usuarios/7');
    expect(repetida.request.method).toBe('DELETE');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer valido');
    repetida.flush({ ok: true });
    expect(resultado).toEqual({ ok: true });
  });

  it('si se cancela, la petición falla con el 403 original y no se repite', () => {
    let estado = 0;
    http.delete('/api/usuarios/7').subscribe({ error: err => (estado = err.status) });
    backend.expectOne('/api/usuarios/7').flush(REQUERIDA, { status: 403, statusText: 'Forbidden' });

    respuesta.next(false);
    backend.expectNone('/api/usuarios/7');
    expect(estado).toBe(403);
  });

  it('sin 2FA pide la contraseña; y un 403 normal no abre nada', () => {
    http.delete('/api/usuarios/7').subscribe({ error: () => undefined });
    backend.expectOne('/api/usuarios/7').flush({ ...REQUERIDA, metodo: 'password' }, { status: 403, statusText: 'Forbidden' });
    expect(pedir).toHaveBeenCalledWith('password');
    respuesta.next(false);

    pedir.mockClear();
    http.get('/api/usuarios/').subscribe({ error: () => undefined });
    backend.expectOne('/api/usuarios/').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(pedir).not.toHaveBeenCalled();
  });
});
