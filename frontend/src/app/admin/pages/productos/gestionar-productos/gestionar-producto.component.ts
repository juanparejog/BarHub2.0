import { paginar } from 'src/app/shared/paginador/paginar';
import { IMAGEN_PRODUCTO_POR_DEFECTO, ponerImagenPorDefecto } from '../../../../shared/imagen-por-defecto';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ProductoService } from '../services/producto';
import { Producto } from '../interface/producto';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
    selector: 'app-gestionar-producto',
    templateUrl: './gestionar-producto.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarProductoComponent implements OnInit {

  productos: Producto[] = [];

  searchTerm: string = '';

  /** Página del listado (la primera es la 1) y filas por página. */
  pagina = 1;
  tamano = 25;
  sortColumn: 'nombre' | 'descripcion' | 'precio' | 'tipoProducto' = 'nombre';
  sortDirection: 'asc' | 'desc' = 'asc';

  mostrarModalEliminar: boolean = false;
  productoAEliminar: Producto | null = null;

  constructor(
    private readonly productoService: ProductoService,
    private readonly dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.productoService.get().subscribe({
      next: (productos) => {
        console.log('Productos cargados:', productos);
        this.productos = productos;
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.dialogService.mostrarToast('Error al cargar productos');
      }
    });
  }

  sortBy(column: 'nombre' | 'descripcion' | 'precio' | 'tipoProducto'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  /** Las filas de la página actual, tras buscar y ordenar. */
  get productosPagina(): Producto[] {
    return paginar(this.productosFiltrados, this.pagina, this.tamano);
  }

  get productosFiltrados(): Producto[] {
    if (!this.productos) return [];

    const term = this.searchTerm.toLowerCase().trim();

    let result = this.productos.filter(producto => {
      const matchNombre = producto.nombre?.toLowerCase().includes(term) ?? false;
      const matchDescripcion = producto.descripcion?.toLowerCase().includes(term) ?? false;
      const matchTipo = producto.tipoProducto?.toLowerCase().includes(term) ?? false;

      return matchNombre || matchDescripcion || matchTipo;
    });

    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (this.sortColumn === 'precio') {
        valA = a.precio ?? 0;
        valB = b.precio ?? 0;
      } else {
        valA = (a[this.sortColumn] || '').toString().toLowerCase();
        valB = (b[this.sortColumn] || '').toString().toLowerCase();
      }

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = (valA as string).localeCompare(valB as string, undefined, { numeric: true, sensitivity: 'base' });
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  borrarProducto(producto: Producto): void {
    this.productoAEliminar = producto;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminacion(): void {
    if (!this.productoAEliminar) return;

    this.productoService.del(this.productoAEliminar).subscribe({
      next: () => {
        this.dialogService.mostrarToast('Producto eliminado correctamente');
        this.cargarProductos();
        this.cerrarModal();
      },
      error: (err) => {
        console.error('Error eliminando producto:', err);
        this.dialogService.mostrarToast('Error al eliminar el producto');
        this.cerrarModal();
      }
    });
  }

  cerrarModal(): void {
    this.mostrarModalEliminar = false;
    this.productoAEliminar = null;
  }

  onImgError(event: Event): void {
    ponerImagenPorDefecto(event, IMAGEN_PRODUCTO_POR_DEFECTO);
  }
}