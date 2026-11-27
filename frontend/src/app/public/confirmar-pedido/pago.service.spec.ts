import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from 'src/environments/environment';

import { PagoService } from './pago.service';

/** Las dos llamadas del pago con tarjeta: la configuración es pública y el intento va con la sesión. */
describe('PagoService', () => {
  const get = vi.fn().mockReturnValue(of({ tarjeta: false, clavePublica: null, pruebas: true }));
  const post = vi.fn().mockReturnValue(of({ id: 'pi_1', clientSecret: 's', importe: 5 }));
  const servicio = new PagoService({ get, post } as any);

  afterEach(() => localStorage.clear());

  it('pide la configuración del pago sin sesión', () => {
    servicio.configuracion().subscribe();
    expect(get).toHaveBeenCalledWith(`${environment.urlBackendSpring}/pagos/configuracion`);
  });

  it('crea el intento con producto y cantidad, y con el token si hay sesión', () => {
    localStorage.setItem('token', 'token-del-cliente');
    servicio.crearIntento([{ id_producto: 3, cantidad: 2 }]).subscribe();

    const [url, cuerpo, opciones] = post.mock.calls[0];
    expect(url).toBe(`${environment.urlBackendSpring}/pagos/intento`);
    expect(cuerpo).toEqual({ detalles: [{ id_producto: 3, cantidad: 2 }] });
    expect(opciones.headers.get('Authorization')).toBe('Bearer token-del-cliente');
  });
});
