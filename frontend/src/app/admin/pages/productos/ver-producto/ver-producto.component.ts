import { Component, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Producto } from '../interface/producto';
import { ProductoService } from '../services/producto';

@Component({
  selector: 'app-ver-producto',
  templateUrl: './ver-producto.component.html'
})
export class VerProductoComponent implements OnInit {

  producto!: Producto;

  constructor(
    private productoService: ProductoService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarProducto();
  }
  
  cargarProducto() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => {
          return this.productoService.getId(id);
        }),
      )
      .subscribe(
        producto => {
          this.producto = producto;
          console.log('Producto cargada:', this.producto);
        },
        error => {
          console.error('Error al cargar el producto:', error);
        }
      );
  }
    
}