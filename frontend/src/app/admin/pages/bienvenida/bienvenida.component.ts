import { Component, OnInit } from '@angular/core';
import { PedidoService } from '../pedidos/services/pedido';
import { MesaService } from '../mesas/services/mesa';
import { DetallesService } from '../detalles_pedidos/services/detalle';

@Component({
  selector: 'app-bienvenida',
  templateUrl: './bienvenida.component.html',
  styleUrls: ['./bienvenida.component.css']
})
export class BienvenidaComponent implements OnInit {

  totalPedidosHoy: number = 0;
  mesasLibresCount: number = 0;
  totalMesasCount: number = 0;
  cajaDiariaTotal: number = 0;
  
  cargandoMetrics: boolean = true;

  constructor(
    private pedidoService: PedidoService,
    private mesaService: MesaService,
    private detalleService: DetallesService
  ) { }

  ngOnInit(): void {
    this.cargarMetricasReales();
  }

  cargarMetricasReales(): void {
    this.cargandoMetrics = true;

    this.pedidoService.get().subscribe({
      next: (pedidos) => {
        this.totalPedidosHoy = pedidos ? pedidos.length : 0;
      },
      error: (err) => console.error('Error al obtener pedidos:', err)
    });

    this.mesaService.get().subscribe({
      next: (mesas) => {
        if (mesas) {
          this.totalMesasCount = mesas.length;
          this.mesasLibresCount = mesas.filter((m: any) => m.estado === 'disponible' || m.disponible === true).length;
        }
      },
      error: (err) => console.error('Error al obtener mesas:', err)
    });

    this.detalleService.get().subscribe({
      next: (detalles) => {
        if (detalles) {
          this.cajaDiariaTotal = detalles.reduce((total: number, d: any) => {
            const cantidad = Number(d.cantidad) || 0;
            const precio = Number(d.precio_unitario) || 0;
            return total + (cantidad * precio);
          }, 0);
        }
        this.cargandoMetrics = false;
      },
      error: (err) => {
        console.error('Error al obtener detalles:', err);
        this.cargandoMetrics = false;
      }
    });
  }
}