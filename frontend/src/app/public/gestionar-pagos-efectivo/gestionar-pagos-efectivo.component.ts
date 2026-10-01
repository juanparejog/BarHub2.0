import { Component, OnInit } from '@angular/core';
import { PagoService } from '../services/pago';
import { Pago } from '../../admin/pages/pagos/interface/pago';

@Component({
  selector: 'app-gestionar-pagos-efectivo',
  templateUrl: './gestionar-pagos-efectivo.component.html',
  styleUrls: ['./gestionar-pagos-efectivo.component.css']
})
export class GestionarPagosEfectivoComponent implements OnInit {
  pagos: Pago[] = [];
  cargando = false;
  procesandoId: number | null = null;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  constructor(private pagoService: PagoService) {}

  ngOnInit() {
    this.cargarPagos();
  }

  cargarPagos() {
    this.cargando = true;
    this.pagoService.getPagosPendientesEfectivo().subscribe({
      next: (data: any) => {
        // Se asume que data es un array o viene dentro de una propiedad 'data'
        this.pagos = Array.isArray(data) ? data : (data?.data || []);
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al obtener pagos pendientes:', err);
        this.showToastMessage('Error al cargar la lista de pagos', 'error');
        this.cargando = false;
      }
    });
  }

  marcarComoPagado(pago: Pago) {
    if (!pago.id) return;

    this.procesandoId = pago.id;

    this.pagoService.marcarPagoComoCompletado(pago as any).subscribe({
      next: () => {
        pago.estado_pago = 'completado';
        this.pagos = this.pagos.filter(p => p.id !== pago.id);
        this.procesandoId = null;
        this.showToastMessage(`Pedido #${pago.pedido?.id || pago.id_pedido} cobrado correctamente`, 'success');
      },
      error: (err) => {
        console.error('Error al marcar como pagado:', err);
        this.showToastMessage('Error al procesar el cobro', 'error');
        this.procesandoId = null;
      }
    });
  }

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => (this.showToast = false), 3000);
  }

  get totalPendiente(): number {
    return this.pagos.reduce((acc, p) => acc + (p.total || 0), 0);
  }
}