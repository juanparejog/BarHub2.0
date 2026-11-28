import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
import { PedidoService } from '../services/pedido';
import { TiempoRealService } from '../../services/tiempo-real.service';
import { Pedido } from '../interface/pedido';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { type ProductoTraducible, nombreDe } from '../../shared/i18n/producto-idioma';
import { ProductoService } from '../../admin/pages/productos/services/producto';

@Component({
    selector: 'app-seguimiento-pedidos',
    templateUrl: './seguimiento-pedidos.component.html',
    styleUrls: ['./seguimiento-pedidos.component.css', './seguimiento-pasos.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SeguimientoPedidosComponent implements OnInit, OnDestroy {
  pedidos: Pedido[] = [];
  usuario: any;

  private readonly destroy$ = new Subject<void>();
  private timers: any[] = [];

  constructor(
    private readonly pedidoService: PedidoService,
    private readonly tiempoReal: TiempoRealService,
    private readonly idiomas: IdiomaService,
    private readonly productoService: ProductoService
  ) {}

  /** Los productos de la carta por id, para mostrar el nombre de cada línea en el idioma elegido. */
  private productosPorId = new Map<number, ProductoTraducible>();

  ngOnInit(): void {
    this.usuario = JSON.parse(localStorage.getItem('user') || 'null');
    if (this.usuario) {
      this.productoService.get().subscribe({
        next: productos => this.productosPorId = new Map((productos || [])
          .filter(p => p.id != null)
          .map((p): [number, ProductoTraducible] => [p.id as number, p])),
        error: () => undefined
      });
      this.iniciarRefrescoAutomatico();
    }
  }

  private getNivelEstado(pedido: any): number {
    if (!pedido) return 1;

    const estado = (pedido.estado || '').toString().toLowerCase().trim();

    if (['servido', 'entregado', 'completado'].includes(estado)) {
      return 4;
    }

    if (['preparado', 'en_camino', 'de_camino', 'listo', 'listo_para_recoger'].includes(estado)) {
      return 3;
    }

    if (['pendiente', 'en_proceso', 'en_preparacion', 'preparando', 'cocina'].includes(estado)) {
      return 2;
    }

    return 1;
  }

  /** Paso en el que está el pedido: 1 recibido, 2 en cocina, 3 listo o de camino, 4 entregado. */
  nivel(pedido: any): number {
    return this.getNivelEstado(pedido);
  }

  /** Nombre del paso actual, para la etiqueta de la cabecera de la tarjeta. */
  estadoActual(pedido: any): string {
    switch (this.getNivelEstado(pedido)) {
      case 4: return this.idiomas.t('paso.entregado');
      case 3: return this.getPaso3Label(pedido);
      case 2: return this.idiomas.t('paso.cocina');
      default: return this.idiomas.t('paso.recibido');
    }
  }

  /** Los que aún no se han entregado, primero el más reciente. */
  get pedidosEnCurso(): Pedido[] {
    return this.ordenados(this.pedidos.filter(p => this.getNivelEstado(p) < 4));
  }

  /** Los servidos o entregados (se ven 30 minutos), primero el más reciente. */
  get pedidosTerminados(): Pedido[] {
    return this.ordenados(this.pedidos.filter(p => this.getNivelEstado(p) === 4));
  }

  private ordenados(pedidos: Pedido[]): Pedido[] {
    return [...pedidos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  isPasoActivo(pedido: any, paso: string): boolean {
    const nivelActual = this.getNivelEstado(pedido);

    if (paso === 'recibido') return nivelActual === 1;
    if (paso === 'preparacion') return nivelActual === 2;
    if (paso === 'camino') return nivelActual === 3;
    if (paso === 'entregado') return nivelActual === 4;

    return false;
  }

  isPasoCompletado(pedido: any, paso: string): boolean {
    const nivelActual = this.getNivelEstado(pedido);

    if (paso === 'recibido') return nivelActual > 1;
    if (paso === 'preparacion') return nivelActual > 2;
    if (paso === 'camino') return nivelActual > 3;
    if (paso === 'entregado') return nivelActual >= 4;

    return false;
  }

  getPaso3Label(pedido: any): string {
    const tipo = (pedido.tipoPedido || pedido.tipo_pedido || 'MESA').toString().toUpperCase();

    if (tipo.includes('RECOGER') || tipo.includes('LLEVAR')) {
      return this.idiomas.t('paso.listoRecoger');
    }
    if (tipo.includes('DOMICILIO')) {
      return this.idiomas.t('paso.camino');
    }
    return this.idiomas.t('paso.listoServir');
  }

  getPaso3Icon(pedido: any): string {
    const tipo = (pedido.tipoPedido || pedido.tipo_pedido || 'MESA').toString().toUpperCase();

    if (tipo.includes('RECOGER') || tipo.includes('LLEVAR')) {
      return 'bi bi-bag-check-fill';
    }
    if (tipo.includes('DOMICILIO')) {
      return 'bi bi-bicycle';
    }
    return 'bi bi-box-seam';
  }

  getTipoPedidoLabel(pedido: any): string {
    const tipo = (pedido.tipoPedido || pedido.tipo_pedido || 'MESA').toString().toUpperCase();

    if (tipo.includes('MESA')) {
      const numMesa = pedido.mesa?.numero || pedido.numMesa || pedido.mesa || '1';
      return this.idiomas.t('tipo.mesa', { mesa: numMesa });
    }

    if (tipo.includes('RECOGER') || tipo.includes('LLEVAR')) {
      return this.idiomas.t('tipo.recoger');
    }

    if (tipo.includes('DOMICILIO')) {
      const direccion = this.obtenerDireccionCorta(pedido);
      return direccion ? this.idiomas.t('tipo.domicilioEn', { direccion }) : this.idiomas.t('tipo.domicilio');
    }

    return this.idiomas.t('tipo.local');
  }

  getTipoPedidoIcon(pedido: any): string {
    const tipo = (pedido.tipoPedido || pedido.tipo_pedido || 'MESA').toString().toUpperCase();

    if (tipo.includes('MESA')) return 'bi bi-shop';
    if (tipo.includes('RECOGER') || tipo.includes('LLEVAR')) return 'bi bi-bag-check';
    if (tipo.includes('DOMICILIO')) return 'bi bi-geo-alt-fill';
    return 'bi bi-receipt';
  }

  getTipoPedidoClass(pedido: any): string {
    const tipo = (pedido.tipoPedido || pedido.tipo_pedido || 'MESA').toString().toUpperCase();

    if (tipo.includes('MESA')) return 'badge-tipo-mesa';
    if (tipo.includes('RECOGER') || tipo.includes('LLEVAR')) return 'badge-tipo-recoger';
    if (tipo.includes('DOMICILIO')) return 'badge-tipo-domicilio';
    return 'badge-tipo-default';
  }

  obtenerDireccionCorta(pedido: any): string {
    const u = pedido.user || pedido.usuario || this.usuario || {};
    const calle = pedido.calle || u.calle;
    const portal = pedido.portalNum || u.portalNum;
    const piso = pedido.pisoNum || u.pisoNum;
    const puerta = pedido.puerta || u.puerta;

    if (!calle) return '';

    let dir = calle;
    if (portal) dir += `, Nº ${portal}`;
    if (piso) dir += `, ${piso}º`;
    if (puerta) dir += ` ${puerta}`;

    return dir;
  }

  /** Texto que lee el lector de pantalla cuando cambia el estado de un pedido. */
  anuncioEstado = '';
  private readonly estadosPrevios = new Map<Pedido['id'], string>();
  private primeraCargaEstados = true;

  private anunciarCambios(pedidos: Pedido[]): void {
    const mensajes: string[] = [];
    for (const p of pedidos) {
      const estado = (p.estado || '').toString();
      const antes = this.estadosPrevios.get(p.id);
      if (!this.primeraCargaEstados && antes !== undefined && antes !== estado) {
        const nombre = this.idiomas.tSiExiste(`estado.${estado.toUpperCase()}`, estado.replaceAll('_', ' ').toLowerCase());
        mensajes.push(this.idiomas.t('seguimiento.anuncio', { id: p.id, estado: nombre }));
      }
      this.estadosPrevios.set(p.id, estado);
    }
    this.primeraCargaEstados = false;
    if (mensajes.length > 0) {
      this.anuncioEstado = mensajes.join('. ');
    }
  }

  /** Recarga cuando el servidor avisa de un cambio en un pedido propio y, sin conexión, cada 5 s. */
  private iniciarRefrescoAutomatico() {
    this.tiempoReal.recargas('mis-pedidos').pipe(
      switchMap(() => this.pedidoService.getMisPedidos().pipe(
        catchError(err => {
          // Un fallo puntual no vacía la lista: se queda la última que se cargó
          console.error('Error al obtener mis pedidos:', err);
          return EMPTY;
        })
      )),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.pedidos = data.filter(pedido => this.filtrarPedidosVisibles(pedido));
      this.anunciarCambios(this.pedidos);
      this.programarEliminaciones();
    });
  }

  private filtrarPedidosVisibles(pedido: Pedido): boolean {
    const estado = (pedido.estado || '').toString().toLowerCase().trim();

    if (estado === 'servido' || estado === 'entregado' || estado === 'completado') {
      const ahora = Date.now();
      const fechaReferencia = (pedido as any).updatedAt 
        ? new Date((pedido as any).updatedAt).getTime() 
        : new Date(pedido.fecha).getTime();

      const diferenciaMinutos = (ahora - fechaReferencia) / (1000 * 60);
      return diferenciaMinutos <= 30;
    }

    return this.filtrarPedidosDelDia(pedido);
  }

  private filtrarPedidosDelDia(pedido: Pedido): boolean {
    const ahora = new Date();
    const fechaPedido = new Date(pedido.fecha);
    const fechaLimite = new Date(fechaPedido);
    fechaLimite.setDate(fechaLimite.getDate() + 1);
    fechaLimite.setHours(0, 0, 0, 0);

    return ahora < fechaLimite;
  }

  private programarEliminaciones() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];

    this.pedidos.forEach(pedido => {
      const fechaPedido = new Date(pedido.fecha);
      const fechaLimite = new Date(fechaPedido);
      fechaLimite.setDate(fechaLimite.getDate() + 1);
      fechaLimite.setHours(0, 0, 0, 0);

      const tiempoRestante = fechaLimite.getTime() - Date.now();

      if (tiempoRestante > 0) {
        const t = setTimeout(() => {
          this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
        }, tiempoRestante);

        this.timers.push(t);
      }
    });
  }

  calcularTotalPedido(pedido: any): number {
    if (!pedido) return 0;

    const totalDirecto = pedido.precioTotal ?? pedido.precio_total ?? pedido.total ?? pedido.importe;
    if (totalDirecto !== undefined && totalDirecto !== null && !Number.isNaN(totalDirecto)) {
      return Number(totalDirecto);
    }

    if (pedido.detalles && Array.isArray(pedido.detalles)) {
      return pedido.detalles.reduce((acc: number, det: any) => {
        const cantidad = det.cantidad || 0;
        const precio = det.precio_unitario ?? det.precioUnitario ?? det.precio ?? 0;
        return acc + (cantidad * precio);
      }, 0);
    }

    return 0;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.timers.forEach(t => clearTimeout(t));
  }

  /** Nombre de una línea del pedido: traducido si el producto sigue en la carta; si no, el guardado. */
  nombreLinea(det: any): string {
    const producto = this.productosPorId.get(Number(det?.id_producto ?? det?.producto?.id));
    if (producto) {
      return nombreDe(producto, this.idiomas.idioma());
    }
    return det?.producto?.nombre || det?.nombreProducto || det?.nombre || det?.producto_nombre || '';
  }
}
