import { Component, OnInit } from '@angular/core';
import { PedidoService } from '../pedidos/services/pedido';
import { MesaService } from '../mesas/services/mesa';
import { DetallesService } from '../detalles_pedidos/services/detalle';
import { Pedido } from '../pedidos/interface/pedido';

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
    private readonly pedidoService: PedidoService,
    private readonly mesaService: MesaService,
    private readonly detalleService: DetallesService
  ) {}

  ngOnInit(): void {
    this.cargarMetricasReales();
  }

  cargarMetricasReales(): void {
    this.cargandoMetrics = true;

    this.mesaService.get().subscribe({
      next: (mesas) => {
        if (mesas) {
          this.totalMesasCount = mesas.length;
          this.mesasLibresCount = mesas.filter((m: any) => m.estado === 'disponible' || m.disponible === true).length;
        }
      },
      error: (err) => console.error('Error al obtener mesas:', err)
    });

    this.pedidoService.get().subscribe({
      next: (pedidos: Pedido[]) => {
        if (pedidos) {
          this.totalPedidosHoy = pedidos.length;

          const pedidosCobrados = pedidos.filter((p: any) => 
            p.estado === 'pagado' || p.estado === 'completado' || p.estado_pago === 'COMPLETADO'
          );

          this.cajaDiariaTotal = pedidosCobrados.reduce((sum: number, p: Pedido) => {
            if (p.total !== undefined && p.total !== null) {
              return sum + Number(p.total);
            }
            
            if (p.detalles && p.detalles.length > 0) {
              const subtotalPedido = p.detalles.reduce((acc, d: any) => 
                acc + ((Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0)), 0
              );
              return sum + subtotalPedido;
            }

            return sum;
          }, 0);
        } else {
          this.totalPedidosHoy = 0;
          this.cajaDiariaTotal = 0;
        }

        this.cargandoMetrics = false;
      },
      error: (err) => {
        console.error('Error al obtener pedidos:', err);
        this.cargandoMetrics = false;
      }
    });
  }
}