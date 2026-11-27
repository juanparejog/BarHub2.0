import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { MesaService } from '../../admin/pages/mesas/services/mesa';
import { TiempoRealService } from '../../services/tiempo-real.service';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';
import { CodigoQrService } from '../../auth/dos-factores/codigo-qr.service';

@Component({
    selector: 'app-gestionar-mesas-empleado',
    templateUrl: './gestionar-mesas-empleado.component.html',
    styleUrls: ['./gestionar-mesas-empleado.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarMesasEmpleadoComponent implements OnInit, OnDestroy {
  mesas: Mesa[] = [];
  mesaSeleccionadaQr: Mesa | null = null;
  /** Imagen del QR de la mesa abierta (se dibuja en el navegador, sin servicios de fuera). */
  qrImagen = '';
  qrError = false;

  estados = [
    { value: 'disponible', label: 'Disponible', icon: 'event_available', classBadge: 'badge-disponible' },
    { value: 'ocupada', label: 'Ocupada', icon: 'table_restaurant', classBadge: 'badge-ocupada' },
    { value: 'reservada', label: 'Reservada', icon: 'event_note', classBadge: 'badge-reservada' }
  ];

  constructor(
    private readonly mesaService: MesaService,
    private readonly codigoQr: CodigoQrService,
    private readonly cdr: ChangeDetectorRef,
    private readonly tiempoReal: TiempoRealService
  ) {}

  private readonly destroy$ = new Subject<void>();

  /** Se recarga cuando otro empleado cambia una mesa (aviso del servidor) y, sin conexión, cada 5 s. */
  ngOnInit() {
    this.tiempoReal.recargas('personal').pipe(
      switchMap(() => this.mesaService.get().pipe(catchError(err => {
        console.error('Error al cargar mesas:', err);
        return EMPTY;
      }))),
      takeUntil(this.destroy$)
    ).subscribe(data => this.ponerMesas(data));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private ponerMesas(data: Mesa[]): void {
    this.mesas = data.map((m) => ({ ...m, estado: String(m.estado).toLowerCase() }));
    this.cdr.markForCheck();
  }

  getCountByEstado(estadoNombre: string): number {
    if (!this.mesas) return 0;
    return this.mesas.filter(m => String(m.estado).toUpperCase() === estadoNombre.toUpperCase()).length;
  }

  cargarMesas() {
    this.mesaService.get().subscribe({
      next: (data) => this.ponerMesas(data),
      error: (err) => console.error('Error al cargar mesas:', err)
    });
  }

  setEstado(mesa: Mesa, estado: string) {
    if (mesa.estado === estado || mesa.id == null) return;

    this.mesaService.cambiarEstado(mesa.id, estado).subscribe({
      next: () => {
        mesa.estado = estado;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Detalle del error del backend:', err);
        alert('Error actualizando el estado de la mesa');
      }
    });
  }

  getIconForEstado(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found ? found.icon : 'table_bar';
  }

  getLabelForEstado(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found ? found.label : estado;
  }

  getBadgeClass(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found ? found.classBadge : 'bg-secondary';
  }

  verQr(mesa: Mesa) {
    this.mesaSeleccionadaQr = mesa;
    this.qrImagen = '';
    this.qrError = false;
    this.codigoQr.comoImagen(this.urlCarta(mesa), 320).then(imagen => {
      if (this.mesaSeleccionadaQr === mesa) {
        this.qrImagen = imagen;
        this.cdr.markForCheck();
      }
    }, () => {
      this.qrError = true;
      this.cdr.markForCheck();
    });
  }

  cerrarModalQr() {
    this.mesaSeleccionadaQr = null;
    this.qrImagen = '';
  }

  /**
   * La carta de esta web con la mesa puesta. Va el id de la mesa, que es lo que lee la carta: el
   * codigo impreso (QR001...) es solo una etiqueta. La direccion sale de donde se abre la web, asi
   * que vale igual en local que en produccion.
   */
  urlCarta(mesa: Mesa): string {
    return `${location.origin}/carta?mesa=${mesa.id}`;
  }

  nombreArchivoQr(mesa: Mesa): string {
    return `barhub-mesa-${mesa.id}-qr.png`;
  }
}