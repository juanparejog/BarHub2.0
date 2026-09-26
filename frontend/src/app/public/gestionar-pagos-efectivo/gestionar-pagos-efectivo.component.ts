// gestionar-pagos-efectivo.component.ts
import { Component, OnInit } from '@angular/core';
import { PagoService, Pago } from '../services/pago';

@Component({
  selector: 'app-gestionar-pagos-efectivo',
  templateUrl: './gestionar-pagos-efectivo.component.html',
  styleUrls: ['./gestionar-pagos-efectivo.component.css']
})
export class GestionarPagosEfectivoComponent implements OnInit {
  pagos: Pago[] = [];

  constructor(private pagoService: PagoService) {}

  ngOnInit() {
    this.pagoService.getPagosPendientesEfectivo().subscribe(data => {
        console.log('Pagos recibidos:', JSON.stringify(data));
        this.pagos = data;
    });
  }

  cargarPagos() {
    this.pagoService.getPagosPendientesEfectivo().subscribe(data => this.pagos = data);
  }

  marcarComoPagado(pago: Pago) {
    this.pagoService.marcarPagoComoCompletado(pago).subscribe({
      next: (pagoActualizado) => {
        pago.estado_pago = 'completado';
        this.pagos = this.pagos.filter(p => p.id !== pago.id);
      },
      error: () => alert('Error al marcar como pagado')
    });
  }
  
}