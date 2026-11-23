import { IMAGEN_PRODUCTO_POR_DEFECTO, ponerImagenPorDefecto } from '../../../../shared/imagen-por-defecto';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Producto } from '../interface/producto';
import { ProductoService } from '../services/producto';
import { textoAlergenos } from '../../../../shared/alergenos/alergenos';

@Component({
    selector: 'app-ver-producto',
    templateUrl: './ver-producto.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class VerProductoComponent implements OnInit {

  producto!: Producto;
  readonly textoAlergenos = textoAlergenos;
  readonly imagenPorDefecto = IMAGEN_PRODUCTO_POR_DEFECTO;

  imagenNoDisponible(evento: Event): void {
    ponerImagenPorDefecto(evento, IMAGEN_PRODUCTO_POR_DEFECTO);
  }

  constructor(
    private readonly productoService: ProductoService,
    private readonly activatedRoute: ActivatedRoute,
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
      .subscribe({
        next: producto => {
          this.producto = producto;
          console.log('Producto cargada:', this.producto);
        },
        error: error => {
          console.error('Error al cargar el producto:', error);
        }
      });
  }
    
}