import { Component, OnInit } from '@angular/core';
import { DetallesService } from '../services/detalle';
import { DetallesPedido } from '../interface/detalle';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { PedidoService } from "../../pedidos/services/pedido";
import { ProductoService } from "../../productos/services/producto";
import { tap } from 'rxjs';

@Component({
  selector: 'app-gestionar-detalle',
  templateUrl: './gestionar-detalle.component.html'
})
export class GestionarDetalleComponent implements OnInit {
  pedidos: any[] = [];
  productos: any[] = [];
  detalles: DetallesPedido[] = [];

  constructor(
    private productoService: ProductoService,
    private pedidoService: PedidoService,
    private detalleService: DetallesService,
    private dialogService: DialogService,
  ) { }

  ngOnInit(): void {
    this.pedidoService.get().subscribe(data => this.pedidos = data);
    this.productoService.get().subscribe(data => this.productos = data);
    
    this.cargarDetalles();
  }

  cargarDetalles() {
    this.detalleService.get().subscribe(data => {
      this.detalles = data.map(detalle => ({
        ...detalle,
        pedido: this.pedidos.find(p => p.id === detalle.id_pedido),
        producto: this.productos.find(p => p.id === detalle.id_producto)
      }));
      console.log("Detalles cargados:", this.detalles);
    });
  }  

  // Versión corregida
  borrarDetalle(detalle: DetallesPedido) {
    this.dialogService.solicitarConfirmacion(
      '¿Está seguro de que desea eliminar el detalle del pedido?',
      'Eliminar detalle', 
      () => {
        this.detalleService.del(detalle.id!)
          .subscribe({
            next: () => {
              this.dialogService.mostrarToast('Detalle eliminado correctamente');
              this.cargarDetalles();
            },
            error: (err) => {
              this.dialogService.mostrarToast('Error al eliminar el detalle');
              console.error('Error:', err);
            }
          });
      }
    );
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
}