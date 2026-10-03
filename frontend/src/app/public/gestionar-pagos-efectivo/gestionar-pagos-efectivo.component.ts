import { Component, OnInit } from '@angular/core';
import { PedidoService } from '../services/pedido';
import { Pedido, EstadoPago } from '../../public/interface/pedido';

@Component({
  selector: 'app-gestionar-pagos-efectivo',
  templateUrl: './gestionar-pagos-efectivo.component.html',
  styleUrls: ['./gestionar-pagos-efectivo.component.css']
})
export class GestionarPagosEfectivoComponent implements OnInit {
  pedidosPendientes: Pedido[] = [];
  cargando: boolean = false;
  
  pedidoSeleccionado: Pedido | null = null;
  montoEntregado: number = 0;
  cambioDevolver: number = 0;

  constructor(private pedidoService: PedidoService) {}

  ngOnInit(): void {
    this.cargarPedidosPendientesDePago();
  }

  cargarPedidosPendientesDePago(): void {
    this.cargando = true;
    
    this.pedidoService.getPendientesEfectivo().subscribe({
      next: (pedidos) => {
        this.pedidosPendientes = pedidos;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar pedidos pendientes de pago:', err);
        this.cargando = false;
      }
    });
  }

  seleccionarPedido(pedido: Pedido): void {
    this.pedidoSeleccionado = pedido;
    const total = pedido.precioTotal ?? (pedido as any).total ?? 0;
    this.montoEntregado = total;
    this.calcularCambio();
  }

  calcularCambio(): void {
    if (this.pedidoSeleccionado) {
      const total = this.pedidoSeleccionado.precioTotal ?? (this.pedidoSeleccionado as any).total ?? 0;
      const cambio = this.montoEntregado - total;
      this.cambioDevolver = cambio > 0 ? cambio : 0;
    }
  }

  confirmarCobroEfectivo(): void {
    if (!this.pedidoSeleccionado) return;
  
    const total = this.pedidoSeleccionado.precioTotal ?? (this.pedidoSeleccionado as any).total ?? 0;
  
    if (this.montoEntregado < total) {
      alert('El monto entregado es menor al total del pedido.');
      return;
    }
  
    const payloadActualizacion = {
      id: this.pedidoSeleccionado.id,
      id_mesa: this.pedidoSeleccionado.mesaId || (this.pedidoSeleccionado as any).id_mesa,
      tipo_pedido: (this.pedidoSeleccionado as any).tipoPedido || (this.pedidoSeleccionado as any).tipo_pedido || 'MESA',
      estado: this.pedidoSeleccionado.estado || 'PENDIENTE',
      
      estado_pago: 'COMPLETADO',
      metodo_pago: 'EFECTIVO',
      precio_total: Number(total),
  
      detalles: (this.pedidoSeleccionado.detalles || []).map((det: any) => ({
        id_producto: det.id_producto || det.producto?.id || 0,
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario || det.precioUnitario || 0
      }))
    };
  
    this.pedidoService.put(payloadActualizacion as any).subscribe({
      next: () => {
        alert('Pago procesado correctamente');
        this.pedidoSeleccionado = null;
        this.cargarPedidosPendientesDePago();
      },
      error: (err) => {
        console.error('Error al procesar el pago:', err);
        alert('Ocurrió un error al registrar el pago');
      }
    });
  }
}