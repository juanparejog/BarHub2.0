import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';

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

  filtroEstado: string = 'TODOS';
  
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
          // Si no tiene detalles o los productos no tienen nombre válido
          const necesitaDetalles = !pedido.detalles || 
            pedido.detalles.length === 0 || 
            pedido.detalles.some((d: any) => !this.getNombreProducto(d) || this.getNombreProducto(d) === 'Producto');

          if (necesitaDetalles) {
            this.detalleService.getByPedidoId(pedido.id!).subscribe({
              next: (detalles: any[]) => {
                if (detalles && detalles.length > 0) {
                  pedido.detalles = detalles;
                }
              },
              error: (err) => console.error('Error cargando detalles:', err)
            });
          }
        });

        this.pedidos = sinServir;
      },
      error: (err) => console.error('Error al refrescar comandas:', err)
    });
  }

  /**
   * Extrae el nombre del producto buscando en todos los posibles nombres
   * de propiedades que pueda devolver el Backend de Spring Boot.
   */
  getNombreProducto(det: any): string {
    if (!det) return 'Sin nombre';

    const nombre = 
      det.producto?.nombre ||
      det.productoNombre ||
      det.nombreProducto ||
      det.nombre_producto ||
      det.nombre ||
      det.titulo ||
      det.description;

    if (nombre && nombre.trim() !== '') {
      return nombre;
    }

    return 'Producto';
  }

  esDomicilio(pedido: any): boolean {
    const tipo = String(pedido.tipoPedido || pedido.tipo_pedido || '').toUpperCase();
    const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa;
    return tipo === 'DOMICILIO' || !mesa || mesa === 0;
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

  getPedidosFiltrados(): any[] {
    if (!this.pedidosNoServidos) return [];
    if (this.filtroEstado === 'TODOS') {
      return this.pedidosNoServidos;
    }
    return this.pedidosNoServidos.filter(
      (p) => (p.estado || '').toUpperCase() === this.filtroEstado
    );
  }

  getCountPorEstado(estado: string): number {
    if (!this.pedidosNoServidos) return 0;
    return this.pedidosNoServidos.filter(
      (p) => (p.estado || '').toUpperCase() === estado
    ).length;
  }


getTipoPedidoClass(pedido: any): string {
  const tipo = String(pedido.tipoPedido || pedido.tipo_pedido || '').toUpperCase();
  
  if (tipo === 'DOMICILIO' || tipo === 'DELIVERY') {
    return 'is-domicilio';
  }
  if (tipo === 'RECOGER' || tipo === 'TAKEAWAY' || tipo === 'PARA_LLEVAR' || tipo === 'LLEVAR') {
    return 'is-recoger';
  }
  
  const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa;
  if (!mesa || mesa === 0) {
    return 'is-recoger';
  }

  return 'is-mesa';
}

getTipoPedidoIcon(pedido: any): string {
  const tipoClass = this.getTipoPedidoClass(pedido);
  switch (tipoClass) {
    case 'is-domicilio':
      return 'delivery_dining';
    case 'is-recoger':
      return 'shopping_bag';
    default:
      return 'table_restaurant';
  }
}

getTipoPedidoLabel(pedido: any): string {
  const tipoClass = this.getTipoPedidoClass(pedido);
  switch (tipoClass) {
    case 'is-domicilio':
      return 'A Domicilio';
    case 'is-recoger':
      return 'Recoger en Tienda';
    default:
      const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa;
      return `Mesa ${mesa || ''}`;
  }
}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}