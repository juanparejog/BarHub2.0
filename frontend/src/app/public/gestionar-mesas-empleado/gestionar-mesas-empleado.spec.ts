import { of } from 'rxjs';
import { vi } from 'vitest';

import { GestionarMesasEmpleadoComponent } from './gestionar-mesas-empleado.component';

/** QR de las mesas: se dibuja en el navegador con la dirección de esta web y el id de la mesa. */
describe('GestionarMesasEmpleadoComponent: QR de la mesa', () => {
  const comoImagen = vi.fn();
  const markForCheck = vi.fn();

  function crear() {
    return new GestionarMesasEmpleadoComponent({ get: () => of([]) } as any, { comoImagen } as any, { markForCheck } as any);
  }

  beforeEach(() => {
    comoImagen.mockReset();
    markForCheck.mockReset();
  });

  it('lleva a la carta de esta web con el id de la mesa, no con su etiqueta', async () => {
    comoImagen.mockResolvedValue('data:image/png;base64,AAAA');
    const pantalla = crear();
    const mesa = { id: 4, codigoqr: 'QR004', estado: 'disponible' };

    pantalla.verQr(mesa);
    expect(comoImagen).toHaveBeenCalledWith(`${location.origin}/carta?mesa=4`, 320);
    await Promise.resolve();
    await Promise.resolve();
    expect(pantalla.qrImagen).toBe('data:image/png;base64,AAAA');
    expect(pantalla.nombreArchivoQr(mesa)).toBe('barhub-mesa-4-qr.png');
  });

  it('si se cierra antes de dibujarlo no lo pinta, y si falla lo dice', async () => {
    let resolver: (imagen: string) => void = () => undefined;
    comoImagen.mockReturnValueOnce(new Promise<string>(r => (resolver = r)));
    const pantalla = crear();
    pantalla.verQr({ id: 1, codigoqr: 'QR001', estado: 'disponible' });
    pantalla.cerrarModalQr();
    resolver('data:image/png;base64,BBBB');
    await Promise.resolve();
    await Promise.resolve();
    expect(pantalla.qrImagen).toBe('');

    comoImagen.mockRejectedValueOnce(new Error('sin canvas'));
    pantalla.verQr({ id: 2, codigoqr: 'QR002', estado: 'disponible' });
    await Promise.resolve();
    await Promise.resolve();
    expect(pantalla.qrError).toBe(true);
  });
});
