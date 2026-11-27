import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';
import { ProductoService } from '../../admin/pages/productos/services/producto';
import { TiempoRealService } from '../../services/tiempo-real.service';
import { AvisoSonoroService } from '../../services/aviso-sonoro.service';
import { AvisoService } from '../../shared/avisos/aviso.service';
import { nombreAlergeno } from '../../shared/alergenos/alergenos';

export interface EstadoOpcion {
  value: string;
  label: string;
  icon: string;
}

@Component({
    selector: 'app-gestionar-comandas',
    templateUrl: './gestionar-comandas.component.html',
    styleUrls: ['./gestionar-comandas.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarComandasComponent implements OnInit, OnDestroy {
  pedidos: any[] = [];
  filtroEstado: string = 'TODOS';
  
  private readonly destroy$ = new Subject<void>();

  /** Comanda que se está imprimiendo (se pinta solo en la impresión). */
  comandaImpresa: any = null;
  comandaImpresaEn = new Date();
  /** Alérgenos de cada producto, para la comanda impresa. */
  private alergenosPorProducto = new Map<number, string[] | null>();

  constructor(
    private readonly detalleService: DetallesService, 
    private readonly pedidoService: PedidoService,
    private readonly productoService: ProductoService,
    private readonly tiempoReal: TiempoRealService,
    readonly avisoSonoro: AvisoSonoroService,
    private readonly cdr: ChangeDetectorRef,
    private readonly avisos: AvisoService
  ) {}

  ngOnInit(): void {
    this.productoService.get().subscribe({
      next: productos => {
        this.alergenosPorProducto = new Map((productos || [])
          .filter(p => p.id != null)
          .map((p): [number, string[] | null] => [p.id as number, p.alergenos ?? null]));
      },
      error: () => undefined
    });
    this.iniciarRefrescoAutomatico();
  }

  /** Recarga al entrar una comanda o cambiar un pedido (aviso del servidor) y, sin conexión, cada 5 s. */
  iniciarRefrescoAutomatico(): void {
    this.tiempoReal.recargas('personal').pipe(
      switchMap(() => this.pedidoService.get().pipe(catchError(err => {
        console.error('Error al refrescar comandas:', err);
        return EMPTY;
      }))),
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
        this.anunciarNovedades(sinServir);
      },
      error: (err) => console.error('Error al refrescar comandas:', err)
    });
  }

  /** Texto que lee el lector de pantalla cuando llega una comanda nueva. */
  anuncioComandas = '';
  private readonly idsPrevios = new Set<unknown>();
  private primeraCargaComandas = true;

  private anunciarNovedades(pedidos: any[]): void {
    const nuevos = pedidos.filter(p => !this.idsPrevios.has(p.id));
    if (!this.primeraCargaComandas && nuevos.length > 0) {
      this.anuncioComandas = nuevos.length === 1
        ? `Nueva comanda: pedido ${nuevos[0].id}`
        : `${nuevos.length} comandas nuevas`;
      this.avisoSonoro.sonar();
    }
    pedidos.forEach(p => this.idsPrevios.add(p.id));
    this.primeraCargaComandas = false;
  }

  getNombreProducto(det: any): string {
    if (!det) return 'Sin nombre';

    const nombre = 
      det.producto?.nombre ||
      det.producto_nombre ||
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
      default: {
        const mesa = pedido.mesaId ?? pedido.id_mesa ?? pedido.idMesa ?? pedido.mesa?.numero;
        return `Mesa ${mesa || ''}`;
      }
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
        this.avisos.flotante(`Pedido #${pedido.id}: ${this.getLabelEstado(estadoEnviar)}`);
      },
      error: (err) => {
        console.error('Error actualizando el estado de la comanda:', err);
        this.avisos.flotante(`No se ha podido cambiar el pedido #${pedido.id}. Inténtalo de nuevo.`, 'error');
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

  /* ==========================================
     IMPRESIÓN DE LA COMANDA (ticket de 80 mm)
     ========================================== */

  /** Alérgenos de una línea de la comanda, por nombre; null si el bar aún no los ha indicado. */
  alergenosDe(det: any): string[] | null {
    const id = det?.id_producto ?? det?.idProducto ?? det?.producto?.id;
    const alergenos = id == null ? undefined : this.alergenosPorProducto.get(Number(id));
    return alergenos == null ? null : alergenos.map(a => nombreAlergeno(a));
  }

  /** Imprime solo esta comanda, con el formato del ticket (ver styles.css, «imprimiendo-comanda»). */
  imprimir(pedido: any): void {
    this.comandaImpresa = pedido;
    this.comandaImpresaEn = new Date();
    // El ticket tiene que estar pintado antes de abrir el diálogo de impresión
    this.cdr.detectChanges();
    document.body.classList.add('imprimiendo-comanda');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('imprimiendo-comanda');
      this.comandaImpresa = null;
      this.cdr.markForCheck();
    }, { once: true });
    window.print();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.classList.remove('imprimiendo-comanda');
  }
}
