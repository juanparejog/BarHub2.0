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

describe('AuthService: login con verificación en dos pasos', () => {
  let servicio: AuthService;
  let backend: HttpTestingController;

  /** JWT de pruebas: solo importa el contenido, la firma no se comprueba en el navegador. */
  const token = (contenido: object) =>
    `cabecera.${btoa(JSON.stringify(contenido)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.firma`;
  const TOKEN_ADMIN = token({ sub: 'admin', id: 1, roles: ['ROLE_ADMIN'] });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    servicio = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('si falta el segundo paso devuelve el desafío y no abre la sesión', () => {
    let respuesta: unknown;
    servicio.login({ username: 'admin', password: 'x' }).subscribe(r => (respuesta = r));
    backend.expectOne(r => r.url.endsWith('/auth/login'))
      .flush({ requiere2fa: true, configurar: false, desafio: 'd1', caducaEnSegundos: 300 });

    expect(respuesta).toEqual(expect.objectContaining({ requiere2fa: true, desafio: 'd1' }));
    expect(localStorage.getItem('token')).toBeNull();
    expect(servicio.isAuthenticated()).toBe(false);
  });

  it('sin segundo paso abre la sesión con los roles del token', () => {
    servicio.login({ username: 'ana', password: 'x' }).subscribe();
    backend.expectOne(r => r.url.endsWith('/auth/login'))
      .flush({ token: token({ sub: 'ana', id: 5, roles: ['ROLE_CLIENTE'] }), sesionCaducaEn: Date.now() + 3_600_000, sesionInactividadSegundos: 3600 });

    expect(servicio.isAuthenticated()).toBe(true);
    expect(servicio.getRoles()).toEqual(['ROLE_CLIENTE']);
    expect(localStorage.getItem('usuarioId')).toBe('5');
    expect(localStorage.getItem('username')).toBe('ana');
  });

  it('verificar el código envía el desafío y abre la sesión', () => {
    servicio.verificarDosFactores('d1', '123456').subscribe();
    const peticion = backend.expectOne(r => r.url.endsWith('/auth/2fa/verificar'));
    expect(peticion.request.body).toEqual({ desafio: 'd1', codigo: '123456' });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({ token: TOKEN_ADMIN });

    expect(servicio.hasRole(['ROLE_ADMIN'])).toBe(true);
  });

  it('configurar y activar usan el desafío; activar abre la sesión y trae los códigos', () => {
    let codigos: string[] | null | undefined;
    servicio.configurarDosFactores('d2').subscribe();
    const configurar = backend.expectOne(r => r.url.endsWith('/auth/2fa/configurar'));
    expect(configurar.request.body).toEqual({ desafio: 'd2' });
    configurar.flush({ secreto: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/BarHub:admin' });
    expect(localStorage.getItem('token')).toBeNull();

    servicio.activarDosFactores('d2', '654321').subscribe(r => (codigos = r.codigosRecuperacion));
    backend.expectOne(r => r.url.endsWith('/auth/2fa/activar'))
      .flush({ token: TOKEN_ADMIN, codigosRecuperacion: ['ABCDE-FGHJK'] });

    expect(codigos).toEqual(['ABCDE-FGHJK']);
    expect(localStorage.getItem('token')).toBe(TOKEN_ADMIN);
  });
});
