import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { PedidoService } from '../services/pedido';
import { TiempoRealService } from '../../services/tiempo-real.service';
import { Pedido } from '../../public/interface/pedido';
import { AvisoService } from '../../shared/avisos/aviso.service';

const EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

@Component({
    selector: 'app-gestionar-pagos-efectivo',
    templateUrl: './gestionar-pagos-efectivo.component.html',
    styleUrls: ['./gestionar-pagos-efectivo.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarPagosEfectivoComponent implements OnInit, OnDestroy {
  pedidosPendientes: Pedido[] = [];
  cargando: boolean = false;
  
  pedidoSeleccionado: Pedido | null = null;
  montoEntregado: number = 0;
  cambioDevolver: number = 0;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly pedidoService: PedidoService,
    private readonly tiempoReal: TiempoRealService,
    private readonly avisos: AvisoService
  ) {}

  /** Se recarga cuando entra o cambia un pedido (aviso del servidor) y, sin conexión, cada 5 s. */
  ngOnInit(): void {
    this.cargando = true;
    this.tiempoReal.recargas('personal').pipe(
      switchMap(() => this.pedidoService.getPendientesEfectivo().pipe(catchError(err => {
        console.error('Error al cargar pedidos pendientes de pago:', err);
        this.cargando = false;
        return EMPTY;
      }))),
      takeUntil(this.destroy$)
    ).subscribe(pedidos => this.ponerPendientes(pedidos));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Pone la lista nueva. Si el pedido que se estaba cobrando ya no está (lo ha cobrado otra persona),
   * se quita la selección para no cobrarlo dos veces.
   */
  private ponerPendientes(pedidos: Pedido[] | null): void {
    this.pedidosPendientes = pedidos || [];
    this.cargando = false;
    const seleccionado = this.pedidoSeleccionado;
    if (seleccionado) {
      this.pedidoSeleccionado = this.pedidosPendientes.find(p => p.id === seleccionado.id) ?? null;
    }
  }

  cargarPedidosPendientesDePago(): void {
    this.pedidoService.getPendientesEfectivo().subscribe({
      next: (pedidos) => this.ponerPendientes(pedidos),
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
      this.cambioDevolver = Math.max(cambio, 0);
    }
  }

  sumarEfectivo(cantidad: number): void {
    const actual = Number.parseFloat(this.montoEntregado as any) || 0;
    this.montoEntregado = Number.parseFloat((actual + cantidad).toFixed(2));
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
      this.avisos.flotante('El importe entregado es menor que el total del pedido.', 'error');
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
        const entregado = Number(this.montoEntregado);
        this.avisos.exito({
          titulo: 'Cobro registrado',
          mensaje: `El pedido #${payloadActualizacion.id} queda pagado en efectivo.`,
          detalles: [
            { etiqueta: 'Total', valor: EUROS.format(Number(total)) },
            { etiqueta: 'Entregado', valor: EUROS.format(entregado) },
            { etiqueta: 'Cambio', valor: EUROS.format(Math.max(entregado - Number(total), 0)) }
          ]
        });
        this.pedidoSeleccionado = null;
        this.cargarPedidosPendientesDePago();
      },
      error: (err) => {
        console.error('Error al procesar el pago:', err);
        this.avisos.flotante('No se ha podido registrar el cobro. Inténtalo de nuevo.', 'error');
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
      default: {
        const mesa = pedido.idMesa ?? pedido.mesaId ?? pedido.id_mesa;
        return (mesa && Number(mesa) > 0) ? `Mesa ${mesa}` : 'Mesa Local';
      }
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
      default: {
        const mesa = pedido.idMesa ?? pedido.mesaId ?? pedido.id_mesa;
        return (mesa && Number(mesa) > 0) ? `Mesa ${mesa}` : 'Mesa Local';
      }
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