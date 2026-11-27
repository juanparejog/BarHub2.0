import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import {
  AGRUPAR_MS, RESPALDO_CON_CONEXION_MS, RESPALDO_SIN_CONEXION_MS, TiempoRealService, esAviso, leerAvisos
} from './tiempo-real.service';

const codificar = (texto: string) => new TextEncoder().encode(texto);

/** Un flujo de eventos al que el test va echando trozos. */
function flujo() {
  let controlador!: ReadableStreamDefaultController<Uint8Array>;
  const cuerpo = new ReadableStream<Uint8Array>({ start: c => { controlador = c; } });
  return {
    cuerpo,
    enviar: (texto: string) => controlador.enqueue(codificar(texto)),
    cerrar: () => controlador.close()
  };
}

describe('Avisos en tiempo real: lectura del flujo', () => {
  it('solo cuentan como aviso los eventos de pedido y de mesa', () => {
    expect(esAviso('event:pedido\ndata:{"id":1}')).toBe(true);
    expect(esAviso('event: mesa\ndata:{"id":2}')).toBe(true);
    expect(esAviso('event:conectado\ndata:{}\nretry:3000')).toBe(false);
    expect(esAviso(':latido')).toBe(false);
    expect(esAviso('data:event:pedido')).toBe(false);
  });

  it('junta los trozos aunque un evento llegue partido y acepta saltos de línea de Windows', async () => {
    const f = flujo();
    const avisar = vi.fn();
    const lectura = leerAvisos(f.cuerpo, avisar);

    f.enviar('event:conectado\r\ndata:{}\r\n\r\n:latido\n\nevent:ped');
    f.enviar('ido\ndata:{"id":7}\n');
    f.enviar('\n');
    f.cerrar();
    await lectura;

    expect(avisar).toHaveBeenCalledTimes(1);
  });
});

describe('TiempoRealService', () => {
  let servicio: TiempoRealService;
  const fetchFalso = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchFalso.mockReset();
    vi.stubGlobal('fetch', fetchFalso);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getToken: () => 'token-de-prueba' } }]
    });
    servicio = TestBed.inject(TiempoRealService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('se conecta con el token en la cabecera (no en la URL) y agrupa los avisos que llegan juntos', async () => {
    const f = flujo();
    fetchFalso.mockResolvedValue({ ok: true, status: 200, body: f.cuerpo });
    let recargas = 0;
    const suscripcion = servicio.recargas('personal').subscribe(() => recargas++);

    expect(recargas).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    // Al conectar se recarga por lo que haya cambiado mientras tanto
    expect(recargas).toBe(2);
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/eventos\/personal$/);
    expect(url).not.toContain('token');
    expect(opciones.headers.Authorization).toBe('Bearer token-de-prueba');

    f.enviar('event:conectado\ndata:{}\n\n:latido\n\n');
    await vi.advanceTimersByTimeAsync(AGRUPAR_MS);
    expect(recargas).toBe(2);

    f.enviar('event:pedido\ndata:{"id":1}\n\nevent:pedido\n');
    f.enviar('data:{"id":2}\n\nevent:mesa\ndata:{"id":3}\n\n');
    await vi.advanceTimersByTimeAsync(AGRUPAR_MS);
    expect(recargas).toBe(3);

    // Conectado no hace falta recargar cada 5 s, solo de vez en cuando
    await vi.advanceTimersByTimeAsync(RESPALDO_SIN_CONEXION_MS * 2);
    expect(recargas).toBe(3);
    await vi.advanceTimersByTimeAsync(RESPALDO_CON_CONEXION_MS);
    expect(recargas).toBe(4);

    suscripcion.unsubscribe();
    expect(opciones.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(RESPALDO_CON_CONEXION_MS);
    expect(recargas).toBe(4);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('sin conexión recarga cada 5 s y reintenta esperando cada vez más', async () => {
    fetchFalso.mockResolvedValue({ ok: false, status: 401, body: null });
    let recargas = 0;
    const suscripcion = servicio.recargas('mis-pedidos').subscribe(() => recargas++);

    await vi.advanceTimersByTimeAsync(0);
    expect(recargas).toBe(1);
    expect(fetchFalso.mock.calls[0][0]).toMatch(/\/eventos\/mis-pedidos$/);

    await vi.advanceTimersByTimeAsync(RESPALDO_SIN_CONEXION_MS);
    expect(recargas).toBe(2);
    // Intentos en 0, 1 y 3 s (esperas de 1 y 2 s); el siguiente, a los 7 s
    expect(fetchFalso).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(RESPALDO_SIN_CONEXION_MS);
    expect(recargas).toBe(3);
    expect(fetchFalso).toHaveBeenCalledTimes(4);

    suscripcion.unsubscribe();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(recargas).toBe(3);
    expect(fetchFalso).toHaveBeenCalledTimes(4);
  });

  it('si el servidor cierra la conexión (cada 5 min) se vuelve a conectar y recarga', async () => {
    const primero = flujo();
    const segundo = flujo();
    fetchFalso
      .mockResolvedValueOnce({ ok: true, status: 200, body: primero.cuerpo })
      .mockResolvedValueOnce({ ok: true, status: 200, body: segundo.cuerpo });
    let recargas = 0;
    const suscripcion = servicio.recargas('personal').subscribe(() => recargas++);
    await vi.advanceTimersByTimeAsync(0);
    expect(recargas).toBe(2);

    primero.cerrar();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(recargas).toBe(3);

    suscripcion.unsubscribe();
  });
});
