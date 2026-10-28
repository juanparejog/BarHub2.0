import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer, of } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
import { PedidoService } from '../services/pedido';
import { Pedido } from '../interface/pedido';

@Component({
  selector: 'app-seguimiento-pedidos',
  templateUrl: './seguimiento-pedidos.component.html',
  styleUrls: ['./seguimiento-pedidos.component.css']
})
export class SeguimientoPedidosComponent implements OnInit, OnDestroy {
  pedidos: Pedido[] = [];
  usuario: any;

  private readonly destroy$ = new Subject<void>();
  private timers: any[] = [];

  constructor(private readonly pedidoService: PedidoService) {}

  ngOnInit(): void {
    this.usuario = JSON.parse(localStorage.getItem('user') || 'null');
    if (this.usuario) {
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
      return 'Listo para recoger';
    }
    if (tipo.includes('DOMICILIO')) {
      return 'De camino';
    }
    return 'Listo para servir';
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
      return `En mesa · Mesa ${numMesa}`;
    }

    if (tipo.includes('RECOGER') || tipo.includes('LLEVAR')) {
      return 'Para recoger en tienda';
    }

    if (tipo.includes('DOMICILIO')) {
      const direccion = this.obtenerDireccionCorta(pedido);
      return direccion ? `A domicilio · ${direccion}` : 'A domicilio';
    }

    return 'Pedido en local';
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

  private iniciarRefrescoAutomatico() {
    timer(0, 5000).pipe(
      switchMap(() => this.pedidoService.getMisPedidos().pipe(
        catchError(err => {
          console.error('Error al obtener mis pedidos:', err);
          return of([]);
        })
      )),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.pedidos = data.filter(pedido => this.filtrarPedidosVisibles(pedido));
      this.programarEliminaciones();
    });
  }

  private filtrarPedidosVisibles(pedido: Pedido): boolean {
    const estado = (pedido.estado || '').toString().toLowerCase().trim();

    if (estado === 'servido' || estado === 'entregado' || estado === 'completado') {
      const ahora = new Date().now();
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
          this.eliminarPedidoAutomatico(pedido);
        }, tiempoRestante);

        this.timers.push(t);
      }
    });
  }

  private eliminarPedidoAutomatico(pedido: Pedido) {
    this.pedidoService.del(pedido).subscribe({
      next: () => {
        this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
      },
      error: () => console.error('Error eliminando pedido automáticamente')
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
}