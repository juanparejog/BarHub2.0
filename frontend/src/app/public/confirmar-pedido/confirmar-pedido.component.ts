import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';
import { AuthService } from '../../auth/auth.service';

(pdfMake as any).addVirtualFileSystem(pdfFonts);

export type TipoPedido = 'MESA' | 'DOMICILIO';

interface ProductoSeleccionado {
  producto: {
    id: number;
    nombre: string;
    precio: number;
  };
  cantidad: number;
}

interface PedidoTemporal {
  tipoPedido: TipoPedido;
  idMesa?: number | null;
  direccionEnvio?: string | null;
  telefonoContacto?: string | null;
  productos: ProductoSeleccionado[];
  precioTotal: number;
}

@Component({
  selector: 'app-confirmar-pedido',
  templateUrl: './confirmar-pedido.component.html',
  styleUrls: ['./confirmar-pedido.component.css']
})
export class ConfirmarPedidoComponent implements OnInit {
  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  card: any = null;
  cardErrors: string = '';
  
  pedidoTemporal: PedidoTemporal | null = null;
  metodoPago: string = 'efectivo';

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private pedidoService: PedidoService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    const pedidoData = localStorage.getItem('pedidoTemporal');
    if (pedidoData) {
      this.pedidoTemporal = JSON.parse(pedidoData);
    } else {
      this.router.navigate(['/carta']);
      return;
    }

    try {
      this.stripe = await loadStripe('pk_test_51RT97qBUQAvN9BbikjitAkEoXkIGMcEcHSVaaCQuceIjZcooPc28iPNKzjrkpw5WwWkm0MG98aezvb4cD6mj4jXq00exCzBE2s');
    } catch (error) {
      console.error('Error initializing Stripe:', error);
    }
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

  async onTarjetaSelected() {
    if (this.metodoPago === 'tarjeta' && this.stripe && !this.card) {
      setTimeout(() => {
        this.elements = this.stripe!.elements();
        this.card = this.elements.create('card', {
          style: {
            base: {
              fontSize: '16px',
              color: '#0A2342',
              '::placeholder': { color: '#7DA7D9' }
            }
          }
        });
        this.card.mount('#card-element');
        this.card.on('change', (event: any) => {
          this.cardErrors = event.error?.message || '';
        });
      }, 50);
    }
  }

  async finalizarPedido() {
    if (!this.pedidoTemporal) return;
  
    this.procesarPedido();
  }
  
  private procesarPedido() {
    if (!this.pedidoTemporal) return;
  
    const mesaIdNum = this.pedidoTemporal.idMesa ? Number(this.pedidoTemporal.idMesa) : null;
    const esTarjeta = this.metodoPago?.toLowerCase() === 'tarjeta';
  
    const dtoPayload = {
      id_mesa: mesaIdNum,
      tipo_pedido: this.pedidoTemporal.tipoPedido,
      direccion_envio: this.pedidoTemporal.tipoPedido === 'DOMICILIO' ? this.pedidoTemporal.direccionEnvio : null,
      telefono_contacto: this.tipoPedidoDomicilio ? this.pedidoTemporal.telefonoContacto : null,
  
      estado: 'PENDIENTE',
      estado_pago: 'PENDIENTE',
      metodo_pago: esTarjeta ? 'TARJETA' : 'EFECTIVO',
      precio_total: Number(this.calcularTotal()),
  
      detalles: this.pedidoTemporal.productos.map(item => ({
        id_producto: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio
      }))
    };
  
    console.log('Enviando DTO al backend:', dtoPayload);
  
    this.pedidoService.postCrearSeguro(dtoPayload).subscribe({
      next: (res) => {
        console.log('Pedido creado con éxito', res);
        this.showToastMessage('¡Pedido realizado con éxito!', 'success');
  
        const idPedidoCreado = res.id || 1;
        this.generarTicketPDF(idPedidoCreado);
  
        localStorage.removeItem('pedidoTemporal');
  
        setTimeout(() => {
          this.router.navigate(['/carta']);
        }, 2500);
      },
      error: (err) => {
        console.error('Error al guardar el pedido:', err);
        this.showToastMessage('Error al procesar el pedido', 'error');
      }
    });
  }

  get tipoPedidoDomicilio(): boolean {
    return this.pedidoTemporal?.tipoPedido === 'DOMICILIO';
  }

  cancelarPedido() {
    if (confirm('¿Desea cancelar y regresar a la carta?')) {
      localStorage.removeItem('pedidoTemporal');
      this.router.navigate(['/carta']);
    }
  }

  generarTicketPDF(pedidoId: number) {
    if (!this.pedidoTemporal) return;
  
    const productosFormatted = this.pedidoTemporal.productos.map(item => [
      { text: `${item.cantidad}x ${item.producto.nombre}`, fontSize: 8, bold: true },
      { text: (item.producto.precio * item.cantidad).toFixed(2) + ' €', alignment: 'right', fontSize: 8 }
    ]);
  
    const esDomicilio = this.tipoPedidoDomicilio;
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
          text: esDomicilio 
            ? `ENTREGA A DOMICILIO\n${this.pedidoTemporal.direccionEnvio}\nTel: ${this.pedidoTemporal.telefonoContacto}`
            : `MESA: #${this.pedidoTemporal.idMesa}`,
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
  
    (pdfMake as any).createPdf(docDefinition).download(`ticket_BarHub_BH-${pedidoId}.pdf`);
  }
}