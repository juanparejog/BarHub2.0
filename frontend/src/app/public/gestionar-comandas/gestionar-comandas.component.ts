import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';

export interface EstadoOpcion {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-gestionar-comandas',
  templateUrl: './gestionar-comandas.component.html',
  styleUrls: ['./gestionar-comandas.component.css']
})
export class GestionarComandasComponent implements OnInit, OnDestroy {
  pedidos: any[] = [];
  filtroEstado: string = 'TODOS';
  
  private destroy$ = new Subject<void>();

  constructor(
    private detalleService: DetallesService, 
    private pedidoService: PedidoService
  ) {}

  ngOnInit(): void {
    this.iniciarRefrescoAutomatico();
  }

  iniciarRefrescoAutomatico(): void {
    timer(0, 5000).pipe(
      switchMap(() => this.pedidoService.get()),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (pedidos: any[]) => {
        const sinServir = pedidos.filter(p => {
          const estadoLower = String(p.estado || '').toLowerCase();
          return estadoLower !== 'servido' && estadoLower !== 'entregado';
        });

        sinServir.forEach(pedido => {
          const necesitaDetalles = !pedido.detalles || 
            pedido.detalles.length === 0 || 
            pedido.detalles.some((d: any) => !this.getNombreProducto(d) || this.getNombreProducto(d) === 'Producto');

          if (necesitaDetalles && pedido.id) {
            this.detalleService.getByPedidoId(pedido.id).subscribe({
              next: (detalles: any[]) => {
                if (detalles && detalles.length > 0) {
                  pedido.detalles = detalles;
                }
              },
              error: (err) => console.error('Error cargando detalles de comanda:', err)
            });
          }
        });

        this.pedidos = sinServir;
      },
      error: (err) => console.error('Error al refrescar comandas:', err)
    });
  }

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

    return (nombre && nombre.trim() !== '') ? nombre : 'Producto';
  }

  /* ==========================================
     LÓGICA DE CLASIFICACIÓN Y ESTADOS
     ========================================== */
  getTipoPedidoClass(pedido: any): string {
    const tipo = String(pedido.tipoPedido || pedido.tipo_pedido || '').toUpperCase();
    
    if (tipo === 'DOMICILIO' || tipo === 'DELIVERY') {
      return 'is-domicilio';
    }
    if (tipo === 'RECOGER' || tipo === 'TAKEAWAY' || tipo === 'PARA_LLEVAR' || tipo === 'LLEVAR') {
      return 'is-recoger';
    }
    
    const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa ?? pedido.mesa?.numero;
    if (!mesa || mesa === 0) {
      return 'is-recoger';
    }

    return 'is-mesa';
  }

  getTipoPedidoIcon(pedido: any): string {
    const tipoClass = this.getTipoPedidoClass(pedido);
    switch (tipoClass) {
      case 'is-domicilio': return 'delivery_dining';
      case 'is-recoger': return 'shopping_bag';
      default: return 'table_restaurant';
    }
  }

  getTipoPedidoLabel(pedido: any): string {
    const tipoClass = this.getTipoPedidoClass(pedido);
    switch (tipoClass) {
      case 'is-domicilio': return 'A Domicilio';
      case 'is-recoger': return 'Recoger en Tienda';
      default:
        const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa ?? pedido.mesa?.numero;
        return `Mesa ${mesa || ''}`;
    }
  }

  obtenerUbicacionPedido(pedido: any): string {
    const tipoClass = this.getTipoPedidoClass(pedido);
    if (tipoClass === 'is-domicilio') {
      const u = pedido.user || pedido.usuario || {};
      const calle = pedido.calle || u.calle;
      const portal = pedido.portalNum || u.portalNum;
      const piso = pedido.pisoNum || u.pisoNum;
      const puerta = pedido.puerta || u.puerta;

      if (calle) {
        let dir = calle;
        if (portal) dir += `, Nº ${portal}`;
        if (piso) dir += `, ${piso}º${puerta ? ' ' + puerta : ''}`;
        return dir;
      }
      return 'Entrega a domicilio';
    }

    if (tipoClass === 'is-recoger') {
      return 'Para recoger en tienda';
    }

    const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa ?? pedido.mesa?.numero;
    return `Consumo en Mesa ${mesa || '-'}`;
  }

  /**
   * Genera las opciones de estado dinámicas según el tipo de pedido
   */
  getEstadosParaPedido(pedido: any): EstadoOpcion[] {
    const tipoClass = this.getTipoPedidoClass(pedido);

    if (tipoClass === 'is-domicilio') {
      return [
        { value: 'pendiente', label: 'En Cocina', icon: 'local_fire_department' },
        { value: 'preparado', label: 'Listo', icon: 'done' },
        { value: 'de_camino', label: 'De Camino', icon: 'delivery_dining' },
        { value: 'servido', label: 'Entregado', icon: 'check_circle' }
      ];
    }

    if (tipoClass === 'is-recoger') {
      return [
        { value: 'pendiente', label: 'En Cocina', icon: 'local_fire_department' },
        { value: 'listo_para_recoger', label: 'Listo p/ Recoger', icon: 'shopping_bag' },
        { value: 'servido', label: 'Entregado', icon: 'check_circle' }
      ];
    }

    // Por defecto: Pedido en Mesa
    return [
      { value: 'pendiente', label: 'En Cocina', icon: 'local_fire_department' },
      { value: 'preparado', label: 'Listo', icon: 'done' },
      { value: 'servido', label: 'Servido', icon: 'check_circle' }
    ];
  }

  cambiarEstado(pedido: any, nuevoEstado: string): void {
    const estadoActual = String(pedido.estado || '').toLowerCase();
    const estadoEnviar = nuevoEstado.toLowerCase();

    if (estadoActual === estadoEnviar) return;

    // Se clona el objeto pedido manteniendo su estructura intacta para evitar errores 500 en Spring Boot
    const payloadActualizacion = {
      ...pedido,
      estado: estadoEnviar,
      tipoPedido: pedido.tipoPedido || pedido.tipo_pedido || 'MESA',
      tipo_pedido: pedido.tipoPedido || pedido.tipo_pedido || 'MESA',
      estadoPago: pedido.estadoPago || pedido.estado_pago || 'PENDIENTE',
      estado_pago: pedido.estadoPago || pedido.estado_pago || 'PENDIENTE',
      metodoPago: pedido.metodoPago || pedido.metodo_pago || 'EFECTIVO',
      metodo_pago: pedido.metodoPago || pedido.metodo_pago || 'EFECTIVO'
    };

    this.pedidoService.put(payloadActualizacion as any).subscribe({
      next: () => {
        pedido.estado = estadoEnviar;
        if (estadoEnviar === 'servido' || estadoEnviar === 'entregado') {
          this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
        }
      },
      error: (err) => {
        console.error('Error actualizando el estado de la comanda:', err);
        alert('Error al actualizar el estado de la comanda en el servidor.');
      }
    });
  }

  getLabelEstado(estado: string): string {
    if (!estado) return 'Desconocido';
    const est = estado.toLowerCase();
    if (est === 'pendiente') return 'En Cocina';
    if (est === 'preparado') return 'Listo';
    if (est === 'listo_para_recoger') return 'Listo p/ Recoger';
    if (est === 'de_camino' || est === 'en_camino') return 'De Camino';
    if (est === 'servido' || est === 'entregado') return 'Servido';
    return estado;
  }

  /* ==========================================
     FILTROS DE PESTAÑAS
     ========================================== */
  get pedidosNoServidos(): any[] {
    return this.pedidos.filter(pedido => {
      const estadoLower = String(pedido.estado || '').toLowerCase();
      return estadoLower !== 'servido' && estadoLower !== 'entregado';
    });
  }

  getPedidosFiltrados(): any[] {
    if (!this.pedidosNoServidos) return [];
    if (this.filtroEstado === 'TODOS') {
      return this.pedidosNoServidos;
    }
    return this.pedidosNoServidos.filter(p => {
      const est = (p.estado || '').toLowerCase();
      const filtroLower = this.filtroEstado.toLowerCase();
      
      if (filtroLower === 'de_camino') {
        return est === 'de_camino' || est === 'en_camino';
      }
      return est === filtroLower;
    });
  }

  getCountPorEstado(estado: string): number {
    if (!this.pedidosNoServidos) return 0;
    const estadoFiltro = estado.toLowerCase();
    
    return this.pedidosNoServidos.filter(p => {
      const est = (p.estado || '').toLowerCase();
      if (estadoFiltro === 'de_camino') {
        return est === 'de_camino' || est === 'en_camino';
      }
      return est === estadoFiltro;
    }).length;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}