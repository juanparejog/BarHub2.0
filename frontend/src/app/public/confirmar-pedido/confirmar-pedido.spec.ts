import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ConfirmarPedidoComponent } from './confirmar-pedido.component';
import type { ConfiguracionPago } from './pago.service';

/**
 * Confirmación del pedido y pago con tarjeta: sin claves no se ofrece, el importe lo pone el servidor,
 * el pedido lleva el id del pago y un pago cobrado no se vuelve a cobrar si el pedido no llega a crearse.
 */
describe('ConfirmarPedidoComponent', () => {
  const PAGO_PENDIENTE = 'barhub.pagoPendiente';
  const pedidoTemporal = {
    tipoPedido: 'RECOGER',
    telefonoContacto: '600000000',
    productos: [{ producto: { id: 1, nombre: 'Croquetas', precio: 2.5 }, cantidad: 2 }],
    precioTotal: 5
  };
  const conTarjeta: ConfiguracionPago = { tarjeta: true, clavePublica: 'pk_test_publica', pruebas: true };

  let postCrearSeguro: ReturnType<typeof vi.fn>;
  let crearIntento: ReturnType<typeof vi.fn>;
  let confirmCardPayment: ReturnType<typeof vi.fn>;
  let exito: ReturnType<typeof vi.fn>;

  function crear(configuracion: ConfiguracionPago): ConfirmarPedidoComponent {
    const componente = new ConfirmarPedidoComponent(
      { postCrearSeguro } as any,
      { isLoggedIn: () => true } as any,
      { navigate: vi.fn().mockResolvedValue(true) } as any,
      {
        t: (clave: string) => clave, idioma: () => 'es', precio: (valor: number) => `${valor} €`,
        delServidor: (mensaje: string, clave: string) => mensaje || clave
      } as any,
      { configuracion: () => of(configuracion), crearIntento, cargarStripe: vi.fn() } as any,
      { exito, error: vi.fn() } as any
    );
    vi.spyOn(componente, 'generarTicketPDF').mockImplementation(() => undefined);
    vi.spyOn(componente, 'showToastMessage').mockImplementation(() => undefined);
    componente.ngOnInit();
    return componente;
  }

  /** Con la tarjeta ya montada: Stripe.js sustituido por un doble. */
  function conTarjetaMontada(componente: ConfirmarPedidoComponent): void {
    componente.metodoPago = 'tarjeta';
    componente.stripe = { confirmCardPayment } as any;
    componente.card = { id: 'tarjeta' } as any;
  }

  const enviado = (llamada = 0) => postCrearSeguro.mock.calls[llamada][0];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pedidoTemporal', JSON.stringify(pedidoTemporal));
    postCrearSeguro = vi.fn().mockReturnValue(of({ id: 7 }));
    crearIntento = vi.fn().mockReturnValue(of({ id: 'pi_123', clientSecret: 'pi_123_secret', importe: 5 }));
    confirmCardPayment = vi.fn().mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    exito = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sin tarjeta en el servidor no se puede elegir y el pedido en efectivo va sin pago', async () => {
    const componente = crear({ tarjeta: false, clavePublica: null, pruebas: true });
    expect(componente.tarjetaDisponible).toBe(false);

    await componente.finalizarPedido();

    expect(crearIntento).not.toHaveBeenCalled();
    expect(enviado().metodo_pago).toBe('EFECTIVO');
    expect(enviado().pago_id).toBeNull();
    expect(componente.procesando).toBe(false);
  });

  it('con tarjeta, el servidor crea el intento, Stripe lo cobra y el pedido lleva el id del pago', async () => {
    const componente = crear(conTarjeta);
    expect(componente.tarjetaDisponible).toBe(true);
    conTarjetaMontada(componente);

    await componente.finalizarPedido();

    // Solo producto y cantidad: el precio lo calcula el servidor
    expect(crearIntento).toHaveBeenCalledWith([{ id_producto: 1, cantidad: 2 }]);
    expect(confirmCardPayment).toHaveBeenCalledWith('pi_123_secret', { payment_method: { card: componente.card } });
    expect(enviado().metodo_pago).toBe('TARJETA');
    expect(enviado().pago_id).toBe('pi_123');
    expect(localStorage.getItem(PAGO_PENDIENTE)).toBeNull();
  });

  it('con el pedido hecho se ve el aviso con su número y su total, y el acceso al seguimiento', async () => {
    const componente = crear(conTarjeta);
    conTarjetaMontada(componente);

    await componente.finalizarPedido();

    const aviso = exito.mock.calls[0][0];
    expect(aviso.titulo).toBe('confirmar.toast.exito');
    expect(aviso.mensaje).toBe('confirmar.exito.tarjeta');
    expect(aviso.detalles).toEqual([
      { etiqueta: 'confirmar.exito.numero', valor: 'BH-000007' },
      { etiqueta: 'confirmar.exito.total', valor: '5 €' }
    ]);
    expect(aviso.acciones.map((a: any) => a.texto)).toEqual(['confirmar.exito.seguir', 'confirmar.volver']);
    expect(localStorage.getItem('pedidoTemporal')).toBeNull();
  });

  it('si Stripe rechaza la tarjeta no se crea el pedido y se ve su mensaje', async () => {
    confirmCardPayment.mockResolvedValue({ error: { message: 'Tu tarjeta ha sido rechazada.' } });
    const componente = crear(conTarjeta);
    conTarjetaMontada(componente);

    await componente.finalizarPedido();

    expect(postCrearSeguro).not.toHaveBeenCalled();
    expect(componente.cardErrors).toBe('Tu tarjeta ha sido rechazada.');
    expect(componente.procesando).toBe(false);
  });

  it('si el pedido no llega a crearse, el reintento usa el mismo pago sin cobrar otra vez', async () => {
    postCrearSeguro
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(of({ id: 8 }));
    const componente = crear(conTarjeta);
    conTarjetaMontada(componente);

    await componente.finalizarPedido();
    expect(JSON.parse(localStorage.getItem(PAGO_PENDIENTE)!).pagoId).toBe('pi_123');
    await componente.finalizarPedido();

    expect(crearIntento).toHaveBeenCalledTimes(1);
    expect(confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(enviado(1).pago_id).toBe('pi_123');
    expect(localStorage.getItem(PAGO_PENDIENTE)).toBeNull();
  });

  it('un pago guardado para otro carrito no se reutiliza', async () => {
    localStorage.setItem(PAGO_PENDIENTE, JSON.stringify({ pagoId: 'pi_viejo', carrito: '1x5' }));
    const componente = crear(conTarjeta);
    conTarjetaMontada(componente);

    await componente.finalizarPedido();

    expect(confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(enviado().pago_id).toBe('pi_123');
  });

  it('si el servidor rechaza el pago, se olvida: el siguiente intento cobra de nuevo', async () => {
    postCrearSeguro.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'El pago no coincide con el pedido y se ha devuelto.' } })));
    const componente = crear(conTarjeta);
    conTarjetaMontada(componente);

    await componente.finalizarPedido();

    expect(localStorage.getItem(PAGO_PENDIENTE)).toBeNull();
    expect(componente.showToastMessage).toHaveBeenCalledWith('El pago no coincide con el pedido y se ha devuelto.', 'error');
  });

  it('sin la tarjeta escrita no se intenta cobrar', async () => {
    const componente = crear(conTarjeta);
    componente.metodoPago = 'tarjeta';

    await componente.finalizarPedido();

    expect(crearIntento).not.toHaveBeenCalled();
    expect(postCrearSeguro).not.toHaveBeenCalled();
    expect(componente.showToastMessage).toHaveBeenCalledWith('confirmar.toast.tarjeta', 'error');
  });
});
