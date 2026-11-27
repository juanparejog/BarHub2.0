import { paginar } from 'src/app/shared/paginador/paginar';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MesaService } from '../services/mesa';
import { Mesa } from '../interface/mesa';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
    selector: 'app-gestionar-mesa',
    templateUrl: './gestionar-mesa.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarMesaComponent implements OnInit {

  mesas: Mesa[] = [];

  searchTerm: string = '';

  /** Página del listado (la primera es la 1) y filas por página. */
  pagina = 1;
  tamano = 25;
  sortColumn: 'codigoqr' | 'estado' = 'codigoqr';
  sortDirection: 'asc' | 'desc' = 'asc';

  mostrarModalEliminar: boolean = false;
  mesaAEliminar: Mesa | null = null;

  constructor(
    private readonly mesaService: MesaService,
    private readonly dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.cargarMesas();
  }

  cargarMesas(): void {
    this.mesaService.get().subscribe({
      next: (mesas) => {
        console.log('Mesas cargadas:', mesas);
        this.mesas = mesas.map((m) => ({ ...m, estado: String(m.estado).toLowerCase() }));
      },
      error: (err) => {
        console.error('Error cargando mesas:', err);
        this.dialogService.mostrarToast('Error al cargar mesas');
      }
    });
  }

  sortBy(column: 'codigoqr' | 'estado'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  /** Las filas de la página actual, tras buscar y ordenar. */
  get mesasPagina(): Mesa[] {
    return paginar(this.mesasFiltradas, this.pagina, this.tamano);
  }

  get mesasFiltradas(): Mesa[] {
    if (!this.mesas) return [];

    const term = this.searchTerm.toLowerCase().trim();

    let result = this.mesas.filter(mesa => {
      const matchCodigoQr = mesa.codigoqr?.toLowerCase().includes(term) ?? false;
      const matchEstado = mesa.estado?.toLowerCase().includes(term) ?? false;

      return matchCodigoQr || matchEstado;
    });

    result.sort((a, b) => {
      const valA = (a[this.sortColumn] || '').toString().toLowerCase();
      const valB = (b[this.sortColumn] || '').toString().toLowerCase();

      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  borrarMesa(mesa: Mesa): void {
    this.mesaAEliminar = mesa;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminacion(): void {
    if (!this.mesaAEliminar) return;

    this.mesaService.del(this.mesaAEliminar).subscribe({
      next: () => {
        this.dialogService.mostrarToast('Mesa eliminada correctamente');
        this.cargarMesas();
        this.cerrarModal();
      },
      error: (err) => {
        console.error('Error eliminando mesa:', err);
        this.dialogService.mostrarToast('Error al eliminar la mesa');
        this.cerrarModal();
      }
    });
  }

  cerrarModal(): void {
    this.mostrarModalEliminar = false;
    this.mesaAEliminar = null;
  }
}