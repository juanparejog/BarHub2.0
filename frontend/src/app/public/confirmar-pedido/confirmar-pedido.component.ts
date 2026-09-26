import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { Pago } from '../../admin/pages/pagos/interface/pago';
import { Producto } from '../../admin/pages/productos/interface/producto';
import { Pedido } from '../../admin/pages/pedidos/interface/pedido';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PagoService } from '../../admin/pages/pagos/services/pago';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';

(pdfMake as any).addVirtualFileSystem(pdfFonts);

interface ProductoSeleccionado {
  producto: Producto;
  cantidad: number;
}

interface PedidoTemporal {
  idMesa: number;
  productos: ProductoSeleccionado[];
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

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  constructor(
    private detalleService: DetallesService,
    private pagoService: PagoService,
    private pedidoService: PedidoService,
    private router: Router
  ) {}

  async ngOnInit() {
    const pedidoData = localStorage.getItem('pedidoTemporal');
    if (pedidoData) {
      this.pedidoTemporal = JSON.parse(pedidoData);
    } else {
      this.router.navigate(['/carta']);
    }

    // Inicializar Stripe pero NO montar todavía
    try {
      this.stripe = await loadStripe('pk_test_51RT97qBUQAvN9BbikjitAkEoXkIGMcEcHSVaaCQuceIjZcooPc28iPNKzjrkpw5WwWkm0MG98aezvb4cD6mj4jXq00exCzBE2s');
    } catch (error) {
      console.error('Error initializing Stripe:', error);
    }
  }

  calcularTotal(): number {
    if (!this.pedidoTemporal) return 0;
    
    return this.pedidoTemporal.productos.reduce(
      (total, item) => total + (item.producto.precio * item.cantidad), 
      0
    );
  }

  generarTicketPDF(pedidoId: number) {
    if (!this.pedidoTemporal) return;

    const productos = this.pedidoTemporal.productos.map(item => [
      { text: item.producto.nombre, alignment: 'left' },
      { text: item.producto.precio.toFixed(2) + ' €', alignment: 'right' },
      { text: item.cantidad, alignment: 'left' },
      { text: (item.producto.precio * item.cantidad).toFixed(2) + ' €', alignment: 'right' }
    ]);
  
    const docDefinition = {
      content: [
        { text: 'BARHUB - Ticket de Compra', style: 'header' },
        { text: `Pedido Num: ${pedidoId}`, style: 'pedidoId' },
        { text: 'BARHUB SPANISH TIPICAL RESTAURANT', style: 'companyBrand' },
        { text: 'Food Service Project S.L.', style: 'companyDetails' },
        { text: 'C/ Avenida Sinforiano Madroñero 666, 06011 Badajoz', style: 'companyDetails' },
        { text: ' ' },
        { text: 'C.I.F. nº: B12345678', style: 'companyDetails' },

        { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 148, y2: 0, lineWidth: 1, dash: { length: 2 } } ] },

        { text: `Fecha Transacción: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, style: 'transactionInfo' },
        { text: `Factura Simplificada: BH-${pedidoId.toString().padStart(6, '0')}`, style: 'transactionInfo' },

        { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 148, y2: 0, lineWidth: 1, dash: { length: 2 } } ] },

        { text: ' ' },
        { text: `Mesa: ${this.pedidoTemporal.idMesa}`, style: 'tableInfo' },

        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              ['Producto', 'Precio Unit.', 'Cantidad', 'Subtotal'],
              ...productos
            ]
          }
        },
        { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 148, y2: 0, lineWidth: 1, dash: { length: 2 } } ] },
    
      // Totales
      {
        columns: [
          { text: 'Subtotal', style: 'totalLabel', width: '*' },
          { text: this.calcularTotal().toFixed(2) + ' €', style: 'totalValue', width: 'auto' }
        ]
      },
      {
        columns: [
          { text: 'IVA desglosado:', style: 'taxLabel', width: '*' },
          { text: this.calcularTotal().toFixed(2) + ' €', style: 'totalValue', width: 'auto' }
        ]
      },
      {
        columns: [
          { text: '10% IVA (' + this.calcularTotal().toFixed(2) + '):', style: 'taxDetail', width: '*' },
          { text: (this.calcularTotal() * 0.10).toFixed(2) + ' €', style: 'totalValue', width: 'auto' }
        ]
      },

      // Línea separadora
      { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 148, y2: 0, lineWidth: 1, dash: { length: 2 } } ] },

      {
        columns: [
          { text: 'TOTAL 1 EN SALA', style: 'finalTotal', width: '*' },
          { text: this.calcularTotal().toFixed(2) + ' €', style: 'finalTotalValue', width: 'auto' }
        ],
        margin: [0, 5, 0, 5]
      },

      { text: `Atendido en caja Nº ${this.pedidoTemporal.idMesa} - BarHub`, style: 'serviceInfo' },

      // Línea separadora
      { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 148, y2: 0, lineWidth: 1, dash: { length: 2 } } ] },

      { text: ' ' },
      { text: '¡¡¡ MUCHAS GRACIAS POR SU VISITA !!!', style: 'thankYou' },
      { text: ' ' },
      { text: '¿CÓMO HA SIDO SU EXPERIENCIA?', style: 'feedback' },
      { text: ' ' },
      { text: 'DÍGANOSLO EN:', style: 'feedback' },
      { text: 'www.barhub.duckdns.org/experiencia', style: 'website' }
    ],
      styles: {
        companyName: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
        ticketNumber: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 2] },
        companyBrand: { fontSize: 10, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
        companyDetails: { fontSize: 8, alignment: 'center', margin: [0, 0, 0, 1] },
        transactionInfo: { fontSize: 8, alignment: 'left', margin: [0, 1, 0, 1] },
        tableInfo: { fontSize: 8, alignment: 'left', margin: [0, 2, 0, 2] },
        tableHeader: { fontSize: 8, bold: true },
        productName: { fontSize: 8, alignment: 'left' },
        productPrice: { fontSize: 8, alignment: 'right' },
        totalLabel: { fontSize: 8, alignment: 'right', margin: [0, 1, 5, 1] },
        totalValue: { fontSize: 8, alignment: 'right', margin: [0, 1, 0, 1] },
        taxLabel: { fontSize: 8, alignment: 'right', margin: [0, 1, 5, 1] },
        taxDetail: { fontSize: 8, alignment: 'right', margin: [0, 1, 5, 1] },
        finalTotal: { fontSize: 10, bold: true, alignment: 'right', margin: [0, 0, 5, 0] },
        finalTotalValue: { fontSize: 10, bold: true, alignment: 'right' },
        serviceInfo: { fontSize: 7, alignment: 'center', margin: [0, 5, 0, 5] },
        thankYou: { fontSize: 9, bold: true, alignment: 'center', margin: [0, 5, 0, 0] },
        feedback: { fontSize: 8, alignment: 'center', margin: [0, 1, 0, 0] },
        website: { fontSize: 8, alignment: 'center', margin: [0, 1, 0, 5] }
      },

      defaultStyle: {
        font: 'Roboto',
        fontSize: 8
      }
    };
    (pdfMake as any).createPdf(docDefinition).download('ticket_barhub.pdf');
  }

  async onTarjetaSelected() {
    // Solo monta si es tarjeta, Stripe está inicializado y aún no has montado el card
    if (this.metodoPago === 'tarjeta' && this.stripe && !this.card) {
      // Espera a que Angular actualice el DOM y el div #card-element exista
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
      }, 0); // 0 o 50 ms, lo importante es que sea después del cambio de DOM
    }
  }

  async finalizarPedido() {
    if (!this.pedidoTemporal) return;

    if (this.metodoPago === 'tarjeta') {
      if (!this.stripe || !this.card) {
        this.showToastMessage('Error en el sistema de pagos', 'error');
        return;
      }

      const { error, paymentMethod } = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.card,
      });

      if (error) {
        this.showToastMessage(error.message ?? 'Error desconocido en el pago', 'error');
        return;
      }

      this.procesarPedidoConPago(paymentMethod?.id);
      console.log('Payment Method id:' + paymentMethod?.id);
    } else {
      this.procesarPedidoConPago(null);
    }
  }

  private procesarPedidoConPago(paymentMethodId: string | null) {
    const usuario = JSON.parse(localStorage.getItem('user') || 'null');

    const pedido: Pedido = {
      id_mesa: this.pedidoTemporal!.idMesa,
      total: this.calcularTotal(),
      estado: 'pendiente',
      fecha: new Date().toISOString().split('T')[0],
      id_user: usuario?.id,
      paymentMethodId: paymentMethodId || undefined
    };

    this.pedidoService.post(pedido).subscribe({
      next: (pedidoCreado) => {
        const detalles = this.pedidoTemporal!.productos.map(item => ({
          id_pedido: pedidoCreado.id!,
          id_producto: item.producto.id!,
          cantidad: item.cantidad,
          precio_unitario: item.producto.precio
        }));

        detalles.forEach(detalle => {
          this.detalleService.post(detalle).subscribe({
            error: (err) => console.error('Error creando detalle:', err)
          });
        });

        const pago: Pago = {
          id_pedido: pedidoCreado.id,
          metodo_pago: this.metodoPago,
          estado_pago: paymentMethodId ? 'completado' : 'pendiente',
          total: pedidoCreado.total,
          fecha_pago: new Date().toISOString().split('T')[0]
        };

        this.pagoService.post(pago).subscribe({
          next: () => {
            if (pedidoCreado.id !== undefined) {
              this.generarTicketPDF(pedidoCreado.id);
            }
            localStorage.removeItem('pedidoTemporal');
            this.showToastMessage('Pedido realizado con éxito', 'success');
            setTimeout(() => {
              this.router.navigate(['/carta']);
            }, 2000);
          },
          error: (err) => {
            this.showToastMessage('Error al guardar el pago', 'error');
            console.error('Error creando pago:', err);
          }
        });
      },
      error: (err) => {
        this.showToastMessage(err.error?.message || 'Error al guardar el pedido', 'error');
        console.error('Error:', err);
      }
    });
  }

  cancelarPedido() {
    if (confirm('¿Está seguro que desea cancelar el pedido?')) {
      localStorage.removeItem('pedidoTemporal');
      this.router.navigate(['/carta']);
    }
  }
}