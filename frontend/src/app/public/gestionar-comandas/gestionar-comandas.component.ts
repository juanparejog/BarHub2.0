import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';
import { Pedido } from '../../admin/pages/pedidos/interface/pedido';

@Component({
  selector: 'app-gestionar-comandas',
  templateUrl: './gestionar-comandas.component.html',
  styleUrls: ['./gestionar-comandas.component.css']
})
export class GestionarComandasComponent implements OnInit, OnDestroy {
  pedidos: any[] = [];
  
  estados = [
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'PREPARADO', label: 'Preparado' },
    { value: 'SERVIDO', label: 'Servido' }
  ];
  
  private destroy$ = new Subject<void>();

  constructor(
    private detalleService: DetallesService, 
    private pedidoService: PedidoService
  ) {}

  ngOnInit() {
    this.iniciarRefrescoAutomatico();
  }

  iniciarRefrescoAutomatico() {
    timer(0, 5000).pipe(
      switchMap(() => this.pedidoService.get()),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (pedidos: any[]) => {
        const sinServir = pedidos.filter(p => {
          const estadoUpper = String(p.estado || '').toUpperCase();
          return estadoUpper !== 'SERVIDO';
        });

        sinServir.forEach(pedido => {
          if (!pedido.detalles || pedido.detalles.length === 0) {
            this.detalleService.getByPedidoId(pedido.id!).subscribe({
              next: (detalles) => pedido.detalles = detalles,
              error: () => {}
            });
          }
        });

        this.pedidos = sinServir;
      },
      error: (err) => console.error('Error al refrescar comandas:', err)
    });
  }

  cambiarEstado(pedido: any, nuevoEstado: string) {
    const estadoActual = String(pedido.estado || '').toUpperCase();
    if (estadoActual === nuevoEstado) return;
    
    const totalCalc = pedido.precioTotal ?? pedido.precio_total ?? pedido.total ?? 0;
    const mesaNum = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa;

    const payloadActualizacion = {
      id: pedido.id,
      id_mesa: mesaNum,
      tipo_pedido: pedido.tipoPedido || pedido.tipo_pedido || 'MESA',
      estado: nuevoEstado,
      estado_pago: pedido.estadoPago || pedido.estado_pago || 'PENDIENTE',
      metodo_pago: pedido.metodoPago || pedido.metodo_pago || 'EFECTIVO',
      precio_total: Number(totalCalc),
      detalles: (pedido.detalles || []).map((det: any) => ({
        id_producto: det.id_producto || det.producto?.id || 0,
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario || det.precioUnitario || det.producto?.precio || 0
      }))
    };

    this.pedidoService.put(payloadActualizacion as any).subscribe({
      next: () => {
        pedido.estado = nuevoEstado;
        if (nuevoEstado === 'SERVIDO') {
          this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
        }
      },
      error: (err) => {
        console.error('Error actualizando el estado:', err);
        alert('Error actualizando el estado del pedido');
      }
    });
  }

  getLabelEstado(estado: string): string {
    if (!estado) return 'Desconocido';
    const estadoUpper = estado.toUpperCase();
    const encontrado = this.estados.find(e => e.value === estadoUpper);
    return encontrado ? encontrado.label : estado;
  }

  get pedidosNoServidos(): any[] {
    return this.pedidos.filter(pedido => {
      const estadoUpper = String(pedido.estado || '').toUpperCase();
      return estadoUpper !== 'SERVIDO';
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}