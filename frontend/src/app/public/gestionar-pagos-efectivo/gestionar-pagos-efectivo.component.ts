import { Component, OnInit } from '@angular/core';
import { PedidoService } from '../services/pedido';
import { Pedido } from '../../public/interface/pedido';

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
        this.pedidosPendientes = pedidos || [];
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
    const total = pedido.precioTotal ?? (pedido as any).precio_total ?? (pedido as any).total ?? 0;
    this.montoEntregado = Number(total);
    this.calcularCambio();
  }

  calcularCambio(): void {
    if (this.pedidoSeleccionado) {
      const total = this.pedidoSeleccionado.precioTotal ?? (this.pedidoSeleccionado as any).precio_total ?? (this.pedidoSeleccionado as any).total ?? 0;
      const cambio = this.montoEntregado - total;
      this.cambioDevolver = cambio > 0 ? cambio : 0;
    }
  }

  sumarEfectivo(cantidad: number): void {
    const actual = parseFloat(this.montoEntregado as any) || 0;
    this.montoEntregado = parseFloat((actual + cantidad).toFixed(2));
    this.calcularCambio();
  }

  getTotalPendiente(): number {
    if (!this.pedidosPendientes) return 0;
    return this.pedidosPendientes.reduce((acc, p) => acc + (p.precioTotal ?? (p as any).precio_total ?? 0), 0);
  }

  confirmarCobroEfectivo(): void {
    if (!this.pedidoSeleccionado) return;
  
    const total = this.pedidoSeleccionado.precioTotal ?? (this.pedidoSeleccionado as any).precio_total ?? (this.pedidoSeleccionado as any).total ?? 0;
  
    if (this.montoEntregado < total) {
      alert('El monto entregado es menor al total del pedido.');
      return;
    }

    // Mantiene exactamente el tipo de pedido original de la BD
    const tipoPed = (this.pedidoSeleccionado as any).tipo_pedido || 
                    (this.pedidoSeleccionado as any).tipoPedido || 
                    (this.pedidoSeleccionado as any).tipo || 
                    'RECOGER';
  
    const payloadActualizacion = {
      id: this.pedidoSeleccionado.id,
      id_mesa: this.pedidoSeleccionado.mesaId || (this.pedidoSeleccionado as any).id_mesa || null,
      tipo_pedido: tipoPed,
      tipoPedido: tipoPed,
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

  getTipoPedidoClass(pedido: any): string {
    if (!pedido) return 'is-recoger';

    const tipo = String(
      pedido.tipoPedido ?? 
      pedido.tipo_pedido ?? 
      pedido.tipo ?? 
      ''
    ).trim().toUpperCase();

    const direccion = String(pedido.direccionEnvio ?? pedido.direccion_envio ?? '').trim();
    if (tipo === 'DOMICILIO' || tipo === 'DELIVERY' || (direccion.length > 0 && !direccion.toLowerCase().includes('recogida'))) {
      return 'is-domicilio';
    }

    if (tipo === 'RECOGER' || tipo === 'TAKEAWAY' || tipo === 'PARA_LLEVAR' || tipo === 'LLEVAR') {
      return 'is-recoger';
    }

    const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa;
    if (tipo === 'MESA' || (mesa !== undefined && mesa !== null && Number(mesa) > 0)) {
      return 'is-mesa';
    }

    return 'is-recoger';
  }

  getTipoPedidoIcon(pedido: any): string {
    const tipoClass = this.getTipoPedidoClass(pedido);
    switch (tipoClass) {
      case 'is-domicilio':
        return 'delivery_dining';
      case 'is-recoger':
        return 'shopping_bag';
      case 'is-mesa':
        return 'table_restaurant';
      default:
        return 'shopping_bag';
    }
  }

  getTipoPedidoLabel(pedido: any): string {
    const tipoClass = this.getTipoPedidoClass(pedido);
    switch (tipoClass) {
      case 'is-domicilio':
        return 'A Domicilio';
      case 'is-recoger':
        return 'Recoger en Tienda';
      case 'is-mesa':
      default:
        const mesa = pedido.id_mesa ?? pedido.mesaId ?? pedido.idMesa;
        return (mesa && Number(mesa) > 0) ? `Mesa ${mesa}` : 'Mesa Local';
    }
  }

  getTipoPedidoSubtext(pedido: any): string {
    const tipoClass = this.getTipoPedidoClass(pedido);
    switch (tipoClass) {
      case 'is-domicilio':
        return 'Entrega a Domicilio';
      case 'is-recoger':
        return 'Pedido para Recoger en Tienda';
      case 'is-mesa':
      default:
        const mesa = pedido.id_mesa ?? pedido.mesaId ?? pedido.idMesa;
        return (mesa && Number(mesa) > 0) ? `Servicio en Mesa ${mesa}` : 'Servicio en Local';
    }
  }

  cobrarExacto(): void {
    if (this.pedidoSeleccionado) {
      const total = this.pedidoSeleccionado.precioTotal ?? (this.pedidoSeleccionado as any).precio_total ?? 0;
      this.montoEntregado = Number(total);
      this.calcularCambio();
    }
  }
}