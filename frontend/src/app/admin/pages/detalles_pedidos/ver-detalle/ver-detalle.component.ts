import { Component, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { PedidoService } from "../../pedidos/services/pedido";
import { ProductoService } from "../../productos/services/producto";
import { DetallesPedido } from '../interface/detalle';
import { DetallesService } from '../services/detalle';

@Component({
  selector: 'app-ver-detalle',
  templateUrl: './ver-detalle.component.html'
})
export class VerDetalleComponent implements OnInit {
  pedidos: any[] = [];
  productos: any[] = [];
  detalle!: DetallesPedido;

  constructor(
    private detalleService: DetallesService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarDetalle();
  }
  
  cargarDetalle() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => {
          return this.detalleService.getId(id);
        }),
      )
      .subscribe(
        detalle => {
          this.detalle = detalle;
          console.log('Detalle cargado:', this.detalle);
        },
        error => {
          console.error('Error al cargar el detalle:', error);
        }
      );
  }   

  getPedido(id_pedido: number | null | undefined): string {
    if (id_pedido === null || id_pedido === undefined) return 'Pedido no encontrado';
    const pedido = this.pedidos.find(p => p.id === id_pedido);
    console.log(id_pedido);
    return id_pedido.toString();
  }
  
  getProducto(id_producto: number | null | undefined): string {
    if (id_producto === null || id_producto === undefined) return 'Producto no encontrado';
    const producto = this.productos.find(p => p.id === id_producto);
    console.log(id_producto);
    return producto ? producto.nombre : producto.nombre.toString();
  }
}