import { Component, OnInit } from '@angular/core';
import { ProductoService } from '../services/producto';
import { Producto } from '../interface/producto';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { tap } from 'rxjs';

@Component({
  selector: 'app-gestionar-producto',
  templateUrl: './gestionar-producto.component.html'
})
export class GestionarProductoComponent implements OnInit {

  productos: Producto[] = [];

  constructor(
    private productoService: ProductoService,
    private dialogService: DialogService,
  ) { }

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos() {
    this.productoService.get().subscribe(productos => {
      console.log('Productos cargados:', productos);
      this.productos = productos;
    });
  }

  borrarProducto(producto: Producto) {
    this.dialogService.solicitarConfirmacion('¿Está seguro de que desea eliminar el producto?',
       'Eliminar producto', 
      () => {
      this.productoService.del(producto)
        .subscribe(() => {
          this.dialogService.mostrarToast('Producto eliminado correctamente');
          this.cargarProductos();
        });
    });
  }
}