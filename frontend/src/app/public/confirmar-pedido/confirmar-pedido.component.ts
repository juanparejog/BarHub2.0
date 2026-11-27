import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';
import { type ConfiguracionPago, type LineaPago, PagoService } from './pago.service';
import { AvisoService } from '../../shared/avisos/aviso.service';
import { AuthService } from '../../auth/auth.service';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { type ProductoTraducible, nombreDe } from '../../shared/i18n/producto-idioma';

export type TipoPedido = 'MESA' | 'DOMICILIO' | 'RECOGER';

/**
 * Pago ya cobrado cuyo pedido aún no se ha creado (por ejemplo, si se corta la conexión justo después):
 * al volver a intentarlo se usa este pago en vez de cobrar otra vez, si el carrito es el mismo.
 */
const PAGO_PENDIENTE = 'barhub.pagoPendiente';

interface ProductoSeleccionado {
  producto: ProductoTraducible & {
    id: number;
    precio: number;
  };
  cantidad: number;
}

interface PedidoTemporal {
  tipoPedido: TipoPedido;
  idMesa?: number | null;
  direccionEnvio?: string | null;
  ubicacionRecogida?: string | null;
  telefonoContacto?: string | null;
  productos: ProductoSeleccionado[];
  precioTotal: number;
}

@Component({
    selector: 'app-confirmar-pedido',
    templateUrl: './confirmar-pedido.component.html',
    styleUrls: ['./confirmar-pedido.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ConfirmarPedidoComponent implements OnInit {
  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  card: StripeCardElement | null = null;
  cardErrors: string = '';
  configuracionPago: ConfiguracionPago | null = null;
  procesando = false;

  pedidoTemporal: PedidoTemporal | null = null;
  metodoPago: string = 'efectivo';

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private readonly pedidoService: PedidoService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly idiomas: IdiomaService,
    private readonly pagos: PagoService,
    private readonly avisos: AvisoService
  ) {}

  ngOnInit() {
    const pedidoData = localStorage.getItem('pedidoTemporal');
    if (pedidoData) {
      this.pedidoTemporal = JSON.parse(pedidoData);
    } else {
      void this.router.navigate(['/carta']);
      return;
    }

    // Si el servidor no tiene claves de Stripe, solo se ofrece el efectivo
    this.pagos.configuracion().subscribe({
      next: configuracion => this.configuracionPago = configuracion,
      error: () => this.configuracionPago = { tarjeta: false, clavePublica: null, pruebas: true }
    });
  }

  get tarjetaDisponible(): boolean {
    return !!this.configuracionPago?.tarjeta && !!this.configuracionPago.clavePublica;
  }

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  calcularTotal(): number {
    if (!this.pedidoTemporal) return 0;
    return this.pedidoTemporal.productos.reduce(
      (total, item) => total + (item.producto.precio * item.cantidad),
      0
    );
  }

  async onTarjetaSelected(): Promise<void> {
    if (this.metodoPago !== 'tarjeta' || !this.tarjetaDisponible || this.card) {
      return;
    }
    try {
      this.stripe ??= await this.pagos.cargarStripe(this.configuracionPago!.clavePublica!);
    } catch (error) {
      console.error('No se pudo cargar Stripe', error);
    }
    if (!this.stripe) {
      this.cardErrors = this.idiomas.t('confirmar.tarjetaNoDisponible');
      return;
    }
    // El contenedor aparece al elegir tarjeta: se espera a que Angular lo pinte
    setTimeout(() => {
      if (!this.stripe || this.card) return;
      // Los textos y errores de Stripe, en el idioma elegido
      this.elements = this.stripe.elements({ locale: this.idiomas.idioma() });
      this.card = this.elements.create('card', {
        hidePostalCode: true,
        style: {
          base: {
            fontSize: '16px',
            color: '#0A2342',
            '::placeholder': { color: '#7DA7D9' }
          }
        }
      });
      this.card.mount('#card-element');
      this.card.on('change', event => {
        this.cardErrors = event.error?.message || '';
      });
    }, 50);
  }

  async finalizarPedido(): Promise<void> {
    if (!this.pedidoTemporal || this.procesando) return;

    // 1. Validar requerimiento de MESA si el pedido es en local/mesa
    if (this.pedidoTemporal.tipoPedido === 'MESA' && !this.pedidoTemporal.idMesa) {
      this.showToastMessage(this.idiomas.t('confirmar.toast.mesa'), 'error');
      return;
    }

    this.procesando = true;
    let pagoId: string | null = null;
    if (this.metodoPago?.toLowerCase() === 'tarjeta') {
      pagoId = await this.pagarConTarjeta();
      if (!pagoId) {
        this.procesando = false;
        return;
      }
    }
    this.procesarPedido(pagoId);
  }

  /** Las líneas que se pagan: producto y cantidad. El precio lo pone el servidor. */
  private lineasDePago(): LineaPago[] {
    return (this.pedidoTemporal?.productos ?? []).map(item => ({ id_producto: item.producto.id, cantidad: item.cantidad }));
  }

  /** Identifica el carrito, para no reutilizar un pago cobrado con otros productos. */
  private carritoDelPago(): string {
    return this.lineasDePago().map(l => `${l.id_producto}x${l.cantidad}`).sort().join(',');
  }

  /**
   * Cobra con la tarjeta y devuelve el id del pago, o null si no se ha cobrado. Si ya hay un pago
   * cobrado para este mismo carrito (el pedido no llegó a crearse), lo reutiliza.
   */
  private async pagarConTarjeta(): Promise<string | null> {
    const carrito = this.carritoDelPago();
    const pendiente = this.pagoPendiente();
    if (pendiente?.carrito === carrito) {
      return pendiente.pagoId;
    }
    if (!this.stripe || !this.card) {
      this.showToastMessage(this.idiomas.t('confirmar.toast.tarjeta'), 'error');
      return null;
    }
    try {
      const intento = await firstValueFrom(this.pagos.crearIntento(this.lineasDePago()));
      const resultado = await this.stripe.confirmCardPayment(intento.clientSecret, { payment_method: { card: this.card } });
      if (resultado.error) {
        // El mensaje de Stripe ya viene en el idioma elegido (tarjeta rechazada, sin fondos...)
        this.cardErrors = resultado.error.message ?? '';
        this.showToastMessage(this.idiomas.t('confirmar.toast.pago'), 'error');
        return null;
      }
      if (resultado.paymentIntent?.status !== 'succeeded') {
        this.showToastMessage(this.idiomas.t('confirmar.toast.pago'), 'error');
        return null;
      }
      const pagoId = resultado.paymentIntent.id;
      try {
        localStorage.setItem(PAGO_PENDIENTE, JSON.stringify({ pagoId, carrito }));
      } catch {
        // Sin almacenamiento se sigue: solo se pierde el reintento sin volver a cobrar
      }
      return pagoId;
    } catch (err: any) {
      this.showToastMessage(this.idiomas.delServidor(err?.error?.message, 'confirmar.toast.pago'), 'error');
      return null;
    }
  }

  private pagoPendiente(): { pagoId: string; carrito: string } | null {
    try {
      const guardado = JSON.parse(localStorage.getItem(PAGO_PENDIENTE) ?? 'null');
      return guardado && typeof guardado.pagoId === 'string' && typeof guardado.carrito === 'string' ? guardado : null;
    } catch {
      return null;
    }
  }

  private olvidarPagoPendiente(): void {
    try {
      localStorage.removeItem(PAGO_PENDIENTE);
    } catch {
      // Nada que hacer
    }
  }

  private procesarPedido(pagoId: string | null) {
    if (!this.pedidoTemporal) return;

    const esTarjeta = this.metodoPago?.toLowerCase() === 'tarjeta';
    const tipo = this.pedidoTemporal.tipoPedido; // 'MESA', 'DOMICILIO' o 'RECOGER'
  
    // 2. Gestión de idMesa según el tipo de pedido
    // Si es RECOGER, le pasamos la mesa o un valor por defecto si el backend lo requiere obligatoriamente
    let mesaId: number | null = null;
    if (tipo === 'MESA') {
      mesaId = Number(this.pedidoTemporal.idMesa);
    } else if (tipo === 'RECOGER') {
      // Si tu backend requiere un idMesa obligatorio para pedidos que no son a domicilio,
      // usamos la mesa asignada o 0 / 1 como identificador de barra/recogida
      mesaId = this.pedidoTemporal.idMesa ? Number(this.pedidoTemporal.idMesa) : 0;
    }
  
    const direccion = tipo === 'DOMICILIO' ? (this.pedidoTemporal.direccionEnvio || 'Dirección no indicada') : null;
    const telefono = this.pedidoTemporal.telefonoContacto || '000000000';
  
    const dtoPayload = {
      // Enviar en camelCase (Spring Boot)
      idMesa: mesaId,
      tipoPedido: tipo,
      direccionEnvio: direccion,
      telefonoContacto: telefono,
      metodoPago: esTarjeta ? 'TARJETA' : 'EFECTIVO',
      estado: 'PENDIENTE',
      estadoPago: 'PENDIENTE',
      precioTotal: Number(this.calcularTotal()),
  
      // Enviar en snake_case
      id_mesa: mesaId,
      tipo_pedido: tipo,
      direccion_envio: direccion,
      telefono_contacto: telefono,
      metodo_pago: esTarjeta ? 'TARJETA' : 'EFECTIVO',
      estado_pago: 'PENDIENTE',
      precio_total: Number(this.calcularTotal()),
      // El servidor comprueba este pago en Stripe antes de dar el pedido por pagado
      pago_id: pagoId,
  
      detalles: this.pedidoTemporal.productos.map(item => ({
        idProducto: item.producto.id,
        id_producto: item.producto.id,
        cantidad: item.cantidad,
        precioUnitario: item.producto.precio,
        precio_unitario: item.producto.precio
      }))
    };
  
    this.pedidoService.postCrearSeguro(dtoPayload).subscribe({
      next: (res) => {
        this.procesando = false;
        this.olvidarPagoPendiente();

        const idPedidoCreado = res.id || 1;
        const total = this.calcularTotal();
        this.generarTicketPDF(idPedidoCreado);
        localStorage.removeItem('pedidoTemporal');
        this.mostrarPedidoHecho(idPedidoCreado, esTarjeta, total);
      },
      error: (err) => {
        this.procesando = false;
        // Rechazado por el pago (no vale, ya tiene pedido o se ha devuelto): el siguiente intento cobra de nuevo.
        // Si es otro error (conexión, servidor), el pago se guarda para no cobrar dos veces
        if ([402, 403, 409].includes(err?.status)) {
          this.olvidarPagoPendiente();
        }
        console.error('Error al guardar el pedido:', err);
        const clave = [402, 403, 409, 503].includes(err?.status) ? 'confirmar.toast.pagoRechazado' : 'confirmar.toast.error';
        this.showToastMessage(this.idiomas.delServidor(err?.error?.message, clave), 'error');
      }
    });
  }

  get tipoPedidoDomicilio(): boolean {
    return this.pedidoTemporal?.tipoPedido === 'DOMICILIO';
  }

  get tipoPedidoRecoger(): boolean {
    return this.pedidoTemporal?.tipoPedido === 'RECOGER';
  }

  /** Pedido hecho: numero, total y, con sesion, el acceso a su seguimiento. Al cerrar, a la carta. */
  private mostrarPedidoHecho(id: number, conTarjeta: boolean, total: number): void {
    const irA = (ruta: string) => () => void this.router.navigate([ruta]);
    const acciones = this.authService.isLoggedIn()
      ? [
          { texto: this.idiomas.t('confirmar.exito.seguir'), primaria: true, alPulsar: irA('/seguimiento-pedidos') },
          { texto: this.idiomas.t('confirmar.volver'), alPulsar: irA('/carta') }
        ]
      : [{ texto: this.idiomas.t('confirmar.volver'), primaria: true, alPulsar: irA('/carta') }];
    this.avisos.exito({
      titulo: this.idiomas.t('confirmar.toast.exito'),
      mensaje: this.idiomas.t(conTarjeta ? 'confirmar.exito.tarjeta' : 'confirmar.exito.efectivo'),
      detalles: [
        { etiqueta: this.idiomas.t('confirmar.exito.numero'), valor: `BH-${String(id).padStart(6, '0')}` },
        { etiqueta: this.idiomas.t('confirmar.exito.total'), valor: this.idiomas.precio(total) }
      ],
      acciones,
      alCerrar: irA('/carta')
    });
  }

  cancelarPedido() {
    this.avisos.error({
      titulo: this.idiomas.t('confirmar.preguntaCancelar'),
      acciones: [
        { texto: this.idiomas.t('dialogo.cancelar') },
        {
          texto: this.idiomas.t('confirmar.cancelar'), primaria: true, alPulsar: () => {
            localStorage.removeItem('pedidoTemporal');
            void this.router.navigate(['/carta']);
          }
        }
      ]
    });
  }

  /** Nombre del producto en el idioma elegido (el ticket en PDF lo lleva en español). */
  nombreProducto(producto: ProductoTraducible): string {
    return nombreDe(producto, this.idiomas.idioma());
  }

  /** El ticket sale siempre en español: es la factura simplificada del bar, un documento fiscal. */
  generarTicketPDF(pedidoId: number) {
    if (!this.pedidoTemporal) return;

    const productosFormatted = this.pedidoTemporal.productos.map(item => [
      { text: `${item.cantidad}x ${item.producto.nombre}`, fontSize: 8, bold: true },
      { text: (item.producto.precio * item.cantidad).toFixed(2) + ' €', alignment: 'right', fontSize: 8 }
    ]);

    let infoPedidoTexto = `MESA: #${this.pedidoTemporal.idMesa}`;
    if (this.tipoPedidoDomicilio) {
      infoPedidoTexto = `ENTREGA A DOMICILIO\n${this.pedidoTemporal.direccionEnvio || ''}\nTel: ${this.pedidoTemporal.telefonoContacto || ''}`;
    } else if (this.tipoPedidoRecoger) {
      infoPedidoTexto = `PARA RECOGER EN TIENDA\nBarHub Badajoz - Av. Sinforiano Madroñero\nTel: ${this.pedidoTemporal.telefonoContacto || ''}`;
    }

    const fechaActual = new Date();
    const fechaStr = fechaActual.toLocaleDateString('es-ES') + ' ' + fechaActual.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const docDefinition: any = {
      pageSize: {
        width: 226.77,
        height: 'auto'
      },
      pageMargins: [12, 12, 12, 12],
      content: [
        { text: 'BARHUB RESTAURANT', style: 'header' },
        { text: 'Food Service Project S.L.', style: 'subtext' },
        { text: 'CIF: B-12345678', style: 'subtext' },
        { text: 'Av. Sinforiano Madroñero, Badajoz', style: 'subtext' },

        { text: '---------------------------------------------------', style: 'divider' },

        { text: `TICKET SIMPLIFICADO`, style: 'ticketTitle' },
        { text: `Nº: BH-${pedidoId.toString().padStart(6, '0')}`, style: 'ticketNum' },
        { text: `Fecha: ${fechaStr}`, style: 'subtext' },

        { text: '---------------------------------------------------', style: 'divider' },

        {
          text: infoPedidoTexto,
          style: 'tipoPedido'
        },

        { text: '---------------------------------------------------', style: 'divider' },

        // Lista de productos compacta
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              ...productosFormatted
            ]
          },
          layout: 'noBorders'
        },

        { text: '---------------------------------------------------', style: 'divider' },

        // Totales
        {
          columns: [
            { text: 'TOTAL:', style: 'totalLabel', width: '*' },
            { text: this.calcularTotal().toFixed(2) + ' €', style: 'totalValue', width: 'auto' }
          ]
        },
        { text: `(IVA Incluido)`, style: 'ivaText' },
        { text: `Pago: ${this.metodoPago.toUpperCase()}`, style: 'subtext', margin: [0, 4, 0, 0] },

        { text: '---------------------------------------------------', style: 'divider' },

        { text: '¡Gracias por su visita!', style: 'footer' },
        { text: 'www.barhub.es', style: 'footerSub' }
      ],
      styles: {
        header: { fontSize: 13, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
        subtext: { fontSize: 7, alignment: 'center', color: '#333333' },
        divider: { fontSize: 8, alignment: 'center', margin: [0, 2, 0, 2], color: '#666666' },
        ticketTitle: { fontSize: 9, bold: true, alignment: 'center' },
        ticketNum: { fontSize: 10, bold: true, alignment: 'center' },
        tipoPedido: { fontSize: 8, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
        totalLabel: { fontSize: 11, bold: true },
        totalValue: { fontSize: 11, bold: true, alignment: 'right' },
        ivaText: { fontSize: 6, alignment: 'right', italic: true, color: '#555555' },
        footer: { fontSize: 8, bold: true, alignment: 'center', margin: [0, 6, 0, 0] },
        footerSub: { fontSize: 7, alignment: 'center', color: '#555555' }
      }
    };

    void this.descargarPdf(docDefinition, `ticket_BarHub_BH-${pedidoId}.pdf`);
  }

  /**
   * pdfmake y sus fuentes pesan cerca de 2 MB: se cargan solo al generar el ticket, no al abrir la web.
   * Son modulos CommonJS; con el builder de esbuild el contenido llega en `default`.
   */
  private async descargarPdf(docDefinition: unknown, nombreArchivo: string): Promise<void> {
    try {
      const [moduloPdf, moduloFuentes] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ]);
      const pdfMake: any = (moduloPdf as any).default ?? moduloPdf;
      const fuentes: any = (moduloFuentes as any).default ?? moduloFuentes;
      pdfMake.addVirtualFileSystem(fuentes);
      pdfMake.createPdf(docDefinition).download(nombreArchivo);
    } catch (error) {
      console.error('No se pudo generar el ticket en PDF', error);
      this.showToastMessage(this.idiomas.t('confirmar.toast.pdf'), 'error');
    }
  }
}