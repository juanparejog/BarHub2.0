import { Component, OnInit } from '@angular/core';
import { DetallesService } from '../services/detalle';
import { DetallesPedido } from '../interface/detalle';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { PedidoService } from "../../pedidos/services/pedido";
import { ProductoService } from "../../productos/services/producto";
import { forkJoin } from 'rxjs';

type SortableColumn = 'id_pedido' | 'producto' | 'cantidad' | 'precio_unitario';

@Component({
  selector: 'app-gestionar-detalle',
  templateUrl: './gestionar-detalle.component.html'
})
export class GestionarDetalleComponent implements OnInit {
  pedidos: any[] = [];
  productos: any[] = [];
  detalles: DetallesPedido[] = [];

  searchTerm: string = '';
  sortColumn: SortableColumn = 'id_pedido';
  sortDirection: 'asc' | 'desc' = 'asc';

  mostrarModalEliminar: boolean = false;
  detalleAEliminar: DetallesPedido | null = null;

  constructor(
    private readonly productoService: ProductoService,
    private readonly pedidoService: PedidoService,
    private readonly detalleService: DetallesService,
    private readonly dialogService: DialogService
  ) { }

  ngOnInit(): void {
    forkJoin({
      pedidos: this.pedidoService.get(),
      productos: this.productoService.get()
    }).subscribe({
      next: ({ pedidos, productos }) => {
        this.pedidos = pedidos;
        this.productos = productos;
        this.cargarDetalles();
      },
      error: (err) => {
        console.error('Error al cargar datos auxiliares:', err);
        this.dialogService.mostrarToast('Error al cargar datos del sistema');
      }
    });
  }

  cargarDetalles() {
    this.detalleService.get().subscribe({
      next: (data) => {
        this.detalles = data.map(detalle => ({
          ...detalle,
          pedido: this.pedidos.find(p => p.id === detalle.id_pedido),
          producto: this.productos.find(p => p.id === detalle.id_producto)
        }));
        console.log("Detalles cargados:", this.detalles);
      },
      error: (err) => {
        console.error('Error cargando detalles:', err);
        this.dialogService.mostrarToast('Error al cargar detalles de pedido');
      }
    });
  }

  sortBy(column: SortableColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  get detallesFiltrados(): DetallesPedido[] {
    if (!this.detalles) return [];

    const term = this.searchTerm.toLowerCase().trim();

    let result = this.detalles.filter(detalle => {
      const matchPedido = detalle.id_pedido?.toString().includes(term) ?? false;
      const nombreProducto = detalle.producto?.nombre || this.getProductoName(detalle.id_producto);
      const matchProducto = nombreProducto.toLowerCase().includes(term);

      return matchPedido || matchProducto;
    });

    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (this.sortColumn) {
        case 'id_pedido':
          valA = a.id_pedido ?? 0;
          valB = b.id_pedido ?? 0;
          break;
        case 'producto':
          valA = (a.producto?.nombre || this.getProductoName(a.id_producto)).toLowerCase();
          valB = (b.producto?.nombre || this.getProductoName(b.id_producto)).toLowerCase();
          break;
        case 'cantidad':
          valA = a.cantidad ?? 0;
          valB = b.cantidad ?? 0;
          break;
        case 'precio_unitario':
          valA = a.precio_unitario ?? 0;
          valB = b.precio_unitario ?? 0;
          break;
      }

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  getProductoName(id_producto: number | null | undefined): string {
    if (id_producto === null || id_producto === undefined) return 'Producto no encontrado';
    const producto = this.productos?.find(p => p.id === id_producto);
    return producto ? producto.nombre : `ID: ${id_producto}`;
  }

  getPedidoCodigo(id_pedido: number | null | undefined): string {
    if (id_pedido === null || id_pedido === undefined) return 'Pedido no encontrado';
    const pedido = this.pedidos?.find(p => p.id === id_pedido);
    return pedido ? pedido.id?.toString() ?? '' : `ID: ${id_pedido}`;
  }

  borrarDetalle(detalle: DetallesPedido): void {
    this.detalleAEliminar = detalle;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminacion(): void {
    if (!this.detalleAEliminar || !this.detalleAEliminar.id) return;

    this.detalleService.del(this.detalleAEliminar.id).subscribe({
      next: () => {
        this.dialogService.mostrarToast('Detalle eliminado correctamente');
        this.cargarDetalles();
        this.cerrarModal();
      },
      error: (err) => {
        console.error('Error al eliminar el detalle:', err);
        this.dialogService.mostrarToast('Error al eliminar el detalle');
        this.cerrarModal();
      }
    });
  }

  cerrarModal(): void {
    this.mostrarModalEliminar = false;
    this.detalleAEliminar = null;
  }
}