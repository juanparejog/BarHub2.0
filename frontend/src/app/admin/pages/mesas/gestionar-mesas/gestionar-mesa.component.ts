import { Component, OnInit } from '@angular/core';
import { MesaService } from '../services/mesa';
import { Mesa } from '../interface/mesa';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
  selector: 'app-gestionar-mesa',
  templateUrl: './gestionar-mesa.component.html'
})
export class GestionarMesaComponent implements OnInit {

  mesas: Mesa[] = [];

  searchTerm: string = '';
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
        this.mesas = mesas;
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