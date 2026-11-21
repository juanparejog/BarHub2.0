import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthInterceptor } from './auth.interceptor';

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

  it('ante un 401 borra toda la sesión y manda al login', () => {
    localStorage.setItem('token', 'caducado');
    localStorage.setItem('roles', '["ROLE_CLIENTE"]');
    localStorage.setItem('user', '{"id":7,"username":"ana"}');
    localStorage.setItem('theme', 'dark');

    let estado = 0;
    http.get('/api/pedidos').subscribe({ error: err => (estado = err.status) });
    backend.expectOne('/api/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(estado).toBe(401);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('roles')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('ante otros errores conserva la sesión', () => {
    localStorage.setItem('token', 'valido');
    http.get('/api/pedidos').subscribe({ error: () => undefined });
    backend.expectOne('/api/pedidos').flush(null, { status: 500, statusText: 'Server Error' });

    expect(localStorage.getItem('token')).toBe('valido');
    expect(navigate).not.toHaveBeenCalled();
  });
});
