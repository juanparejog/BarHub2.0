import { NEVER, Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { GestionarMesasEmpleadoComponent } from './gestionar-mesas-empleado.component';

/** QR de las mesas: se dibuja en el navegador con la dirección de esta web y el id de la mesa. */
describe('GestionarMesasEmpleadoComponent: QR de la mesa', () => {
  const comoImagen = vi.fn();
  const markForCheck = vi.fn();

  function crear() {
    return new GestionarMesasEmpleadoComponent({ get: () => of([]) } as any, { comoImagen } as any, { markForCheck } as any,
      { recargas: () => NEVER } as any);
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

/** Estado de las mesas: el empleado lo cambia con PATCH y la lista se recarga con los avisos. */
describe('GestionarMesasEmpleadoComponent: estado y tiempo real', () => {
  it('cambia el estado con PATCH (no con el PUT del administrador)', () => {
    const cambiarEstado = vi.fn(() => of({ id: 3, estado: 'OCUPADA' }));
    const put = vi.fn();
    const pantalla = new GestionarMesasEmpleadoComponent({ get: () => of([]), cambiarEstado, put } as any, {} as any,
      { markForCheck: vi.fn() } as any, { recargas: () => NEVER } as any);
    const mesa = { id: 3, codigoqr: 'QR003', estado: 'disponible' };

    pantalla.setEstado(mesa, 'ocupada');

    expect(cambiarEstado).toHaveBeenCalledWith(3, 'ocupada');
    expect(put).not.toHaveBeenCalled();
    expect(mesa.estado).toBe('ocupada');
  });

  it('recarga las mesas con cada aviso y deja de escuchar al salir', () => {
    const avisos = new Subject<void>();
    let llamadas = 0;
    const get = vi.fn(() => of([{ id: 1, codigoqr: 'QR001', estado: llamadas++ === 0 ? 'DISPONIBLE' : 'OCUPADA' }]));
    const pantalla = new GestionarMesasEmpleadoComponent({ get } as any, {} as any, { markForCheck: vi.fn() } as any,
      { recargas: () => avisos } as any);

    pantalla.ngOnInit();
    avisos.next();
    expect(pantalla.mesas[0].estado).toBe('disponible');
    avisos.next();
    expect(pantalla.mesas[0].estado).toBe('ocupada');

    pantalla.ngOnDestroy();
    avisos.next();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
