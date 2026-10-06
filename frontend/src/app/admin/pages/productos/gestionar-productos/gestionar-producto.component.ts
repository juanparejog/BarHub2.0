import { Component, OnInit } from '@angular/core';
import { ProductoService } from '../services/producto';
import { Producto } from '../interface/producto';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
  selector: 'app-gestionar-producto',
  templateUrl: './gestionar-producto.component.html'
})
export class GestionarProductoComponent implements OnInit {

  productos: Producto[] = [];

  searchTerm: string = '';
  sortColumn: 'nombre' | 'descripcion' | 'precio' | 'tipoProducto' = 'nombre';
  sortDirection: 'asc' | 'desc' = 'asc';

  mostrarModalEliminar: boolean = false;
  productoAEliminar: Producto | null = null;

  constructor(
    private productoService: ProductoService,
    private dialogService: DialogService
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
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/productos/default.jpg';
    imgElement.onerror = null;
  }
}