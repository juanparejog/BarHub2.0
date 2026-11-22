import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from './auth.service';

describe('AuthService: confirmación y recuperación por correo', () => {
  let servicio: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    servicio = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const casos: Array<[string, () => void, string, object]> = [
    ['confirmarCorreo', () => servicio.confirmarCorreo('t1').subscribe(), '/auth/verificar', { token: 't1' }],
    ['reenviarConfirmacion', () => servicio.reenviarConfirmacion('ana').subscribe(), '/auth/reenviar-verificacion', { usuario: 'ana' }],
    ['solicitarRecuperacion', () => servicio.solicitarRecuperacion('ana@example.com').subscribe(), '/auth/recuperar', { email: 'ana@example.com' }],
    ['restablecerContrasena', () => servicio.restablecerContrasena('t2', 'NuevaClave99').subscribe(), '/auth/restablecer', { token: 't2', password: 'NuevaClave99' }]
  ];

  for (const [nombre, llamar, ruta, cuerpo] of casos) {
    it(`${nombre} hace POST a ${ruta} con su cuerpo`, () => {
      llamar();
      const peticion = backend.expectOne(r => r.url.endsWith(ruta));
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body).toEqual(cuerpo);
      peticion.flush({ message: 'ok' });
    });
  }
});
