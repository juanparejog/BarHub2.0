import { Component, OnInit } from '@angular/core';
import { switchMap, forkJoin } from 'rxjs';
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
    private productoService: ProductoService,
    private pedidoService: PedidoService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    forkJoin({
      productos: this.productoService.get(),
      pedidos: this.pedidoService.get()
    }).pipe(
      switchMap(({ productos, pedidos }) => {
        this.productos = productos;
        this.pedidos = pedidos;
        
        return this.activatedRoute.params.pipe(
          switchMap(({ id }) => this.detalleService.getId(id))
        );
      })
    ).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
        console.log('Detalle cargado:', this.detalle);
      },
      error: (err) => {
        console.error('Error al cargar la información:', err);
      }
    });
  }

  getPedido(id_pedido: number | null | undefined): string {
    if (id_pedido === null || id_pedido === undefined) return 'N/A';
    const pedido = this.pedidos.find(p => p.id === id_pedido);
    return pedido ? (pedido.id?.toString() ?? id_pedido.toString()) : `#${id_pedido}`;
  }

  getProducto(id_producto: number | null | undefined): string {
    if (id_producto === null || id_producto === undefined) return 'Producto no encontrado';
    const producto = this.productos.find(p => p.id === id_producto);
    return producto?.nombre || `ID Producto: ${id_producto}`;
  }
}