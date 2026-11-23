import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReautenticacionService } from './reautenticacion.service';

describe('ReautenticacionService', () => {
  let servicio: ReautenticacionService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ReautenticacionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('abre la ventana y, con el código correcto, deja seguir a todas las peticiones que esperaban', () => {
    const resultados: boolean[] = [];
    servicio.pedir('codigo').subscribe(r => resultados.push(r));
    servicio.pedir('codigo').subscribe(r => resultados.push(r));
    expect(servicio.solicitud()).toBe('codigo');

    servicio.confirmar('123456').subscribe();
    const peticion = backend.expectOne(r => r.url.endsWith('/auth/reautenticar'));
    expect(peticion.request.body).toEqual({ codigo: '123456' });
    peticion.flush({ reautenticadaHasta: Date.now() + 300_000 });

    expect(resultados).toEqual([true, true]);
    expect(servicio.solicitud()).toBeNull();
  });

  it('con un código incorrecto la ventana sigue abierta', () => {
    let resultado: boolean | undefined;
    servicio.pedir('codigo').subscribe(r => (resultado = r));
    let error: unknown;
    servicio.confirmar('000000').subscribe({ error: e => (error = e) });
    backend.expectOne(r => r.url.endsWith('/auth/reautenticar'))
      .flush({ code: 'CODIGO_INCORRECTO', message: 'Código incorrecto.' }, { status: 400, statusText: 'Bad Request' });

    expect(error).toBeDefined();
    expect(resultado).toBeUndefined();
    expect(servicio.solicitud()).toBe('codigo');
  });

  it('sin la verificación en dos pasos envía la contraseña, y cancelar devuelve false', () => {
    servicio.pedir('password').subscribe();
    servicio.confirmar('MiClave1').subscribe();
    expect(backend.expectOne(r => r.url.endsWith('/auth/reautenticar')).request.body).toEqual({ password: 'MiClave1' });

    let resultado: boolean | undefined;
    servicio.pedir('codigo').subscribe(r => (resultado = r));
    servicio.cancelar();
    expect(resultado).toBe(false);
    expect(servicio.solicitud()).toBeNull();
  });
});
