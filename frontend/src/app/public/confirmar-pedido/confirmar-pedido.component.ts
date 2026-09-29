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

    if (this.metodoPago === 'tarjeta') {
      if (!this.stripe || !this.card) {
        this.showToastMessage('Suscripción a pasarela de pago no disponible', 'error');
        return;
      }

      const { error, paymentMethod } = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.card,
      });

      if (error) {
        this.showToastMessage(error.message ?? 'Error procesando la tarjeta', 'error');
        return;
      }

      this.procesarPedido(paymentMethod?.id || null);
    } else {
      this.procesarPedido(null);
    }
  }

  private procesarPedido(paymentMethodId: string | null) {
    if (!this.pedidoTemporal) return;

    // Construcción del DTO unificado compatible con el endpoint seguro del backend
    const dtoPayload = {
      tipo_pedido: this.pedidoTemporal.tipoPedido,
      id_mesa: this.pedidoTemporal.tipoPedido === 'MESA' ? this.pedidoTemporal.idMesa : null,
      direccion_envio: this.pedidoTemporal.tipoPedido === 'DOMICILIO' ? this.pedidoTemporal.direccionEnvio : null,
      telefono_contacto: this.tipoPedidoDomicilio ? this.pedidoTemporal.telefonoContacto : null,
      precio_total: this.calcularTotal(),
      paymentMethodId: paymentMethodId,
      estado: 'pendiente',
      detalles: this.pedidoTemporal.productos.map(item => ({
        id_producto: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio
      }))
    };

    // Petición al endpoint backend seguro
    this.pedidoService.postCrearSeguro(dtoPayload).subscribe({
      next: (pedidoCreado: any) => {
        const idGenerado = pedidoCreado.id || Math.floor(Math.random() * 10000);
        this.generarTicketPDF(idGenerado);
        localStorage.removeItem('pedidoTemporal');
        this.showToastMessage('¡Pedido realizado con éxito!', 'success');
        
        setTimeout(() => {
          this.router.navigate(['/seguimiento-pedidos']);
        }, 2000);
      },
      error: (err) => {
        console.error('Error al guardar el pedido:', err);
        this.showToastMessage(err.error?.message || 'Error al procesar el pedido con el servidor', 'error');
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

  // Generación de Ticket PDF estilizado
  generarTicketPDF(pedidoId: number) {
    if (!this.pedidoTemporal) return;

    const productosFormatted = this.pedidoTemporal.productos.map(item => [
      { text: item.producto.nombre, alignment: 'left' },
      { text: item.producto.precio.toFixed(2) + ' €', alignment: 'right' },
      { text: item.cantidad.toString(), alignment: 'center' },
      { text: (item.producto.precio * item.cantidad).toFixed(2) + ' €', alignment: 'right' }
    ]);

    const esDomicilio = this.tipoPedidoDomicilio;
    const destinoInfo = esDomicilio 
      ? `DOMICILIO: ${this.pedidoTemporal.direccionEnvio} (Tel: ${this.pedidoTemporal.telefonoContacto})` 
      : `MESA EN LOCAL: #${this.pedidoTemporal.idMesa}`;

    const docDefinition: any = {
      content: [
        { text: 'BARHUB RESTAURANT', style: 'header' },
        { text: `Ticket Nº: BH-${pedidoId.toString().padStart(6, '0')}`, style: 'subHeader' },
        { text: 'Food Service Project S.L.', style: 'companyDetails' },
        { text: 'Av. Sinforiano Madroñero, Badajoz', style: 'companyDetails' },
        { text: `Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, style: 'transactionInfo' },
        { text: '--------------------------------------------------------------------------------------------------' },
        { text: destinoInfo, style: 'destinoStyle' },
        { text: '--------------------------------------------------------------------------------------------------' },
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              ['Producto', 'Precio U.', 'Cant.', 'Subtotal'],
              ...productosFormatted
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: '--------------------------------------------------------------------------------------------------' },
        {
          columns: [
            { text: 'TOTAL PEDIDO:', style: 'totalLabel', width: '*' },
            { text: this.calcularTotal().toFixed(2) + ' €', style: 'totalValue', width: 'auto' }
          ],
          margin: [0, 5, 0, 5]
        },
        { text: `Método de Pago: ${this.metodoPago.toUpperCase()}`, style: 'companyDetails' },
        { text: '\n¡Muchas gracias por su confianza!', style: 'thankYou' }
      ],
      styles: {
        header: { fontSize: 14, bold: true, alignment: 'center' },
        subHeader: { fontSize: 10, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
        companyDetails: { fontSize: 8, alignment: 'center' },
        transactionInfo: { fontSize: 8, alignment: 'center', margin: [0, 2, 0, 2] },
        destinoStyle: { fontSize: 9, bold: true, alignment: 'center', margin: [0, 4, 0, 4] },
        totalLabel: { fontSize: 11, bold: true },
        totalValue: { fontSize: 11, bold: true, alignment: 'right' },
        thankYou: { fontSize: 9, italic: true, alignment: 'center' }
      }
    };

    (pdfMake as any).createPdf(docDefinition).download(`ticket_BarHub_BH-${pedidoId}.pdf`);
  }
}