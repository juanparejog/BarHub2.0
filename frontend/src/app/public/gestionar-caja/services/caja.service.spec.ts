import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CajaService } from './caja.service';

describe('CajaService', () => {
  let servicio: CajaService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    servicio = TestBed.inject(CajaService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('devuelve la caja abierta', () => {
    let recibida: unknown;
    servicio.obtenerCajaActual().subscribe(caja => (recibida = caja));
    backend.expectOne(r => r.method === 'GET' && r.url.endsWith('/caja/actual')).flush({ id: 7, estado: 'ABIERTA' });
    expect(recibida).toEqual({ id: 7, estado: 'ABIERTA' });
  });

  it('devuelve null, sin error, cuando no hay caja abierta (204)', () => {
    let recibida: unknown = 'sin respuesta';
    let error = false;
    servicio.obtenerCajaActual().subscribe({ next: caja => (recibida = caja), error: () => (error = true) });
    backend.expectOne(r => r.url.endsWith('/caja/actual')).flush(null, { status: 204, statusText: 'No Content' });
    expect(recibida).toBeNull();
    expect(error).toBe(false);
  });

  it('abre la caja con POST y la cierra con PUT', () => {
    servicio.abrirCaja({ montoInicial: 150 }).subscribe();
    expect(backend.expectOne(r => r.url.endsWith('/caja/abrir')).request.method).toBe('POST');
    servicio.cerrarCaja({ efectivoReal: 150 }).subscribe();
    expect(backend.expectOne(r => r.url.endsWith('/caja/cerrar')).request.method).toBe('PUT');
    backend.match(() => true).forEach(p => p.flush({}));
  });

  it('pide el historial', () => {
    let filas: unknown[] = [];
    servicio.obtenerHistorial().subscribe(h => (filas = h));
    backend.expectOne(r => r.method === 'GET' && r.url.endsWith('/caja/historial')).flush([{ id: 1 }, { id: 2 }]);
    expect(filas).toHaveLength(2);
  });
});
