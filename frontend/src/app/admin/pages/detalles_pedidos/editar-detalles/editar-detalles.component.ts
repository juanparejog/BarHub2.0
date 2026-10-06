import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { DetallesService } from '../services/detalle';
import { PedidoService } from '../../pedidos/services/pedido';
import { ProductoService } from '../../productos/services/producto';
import { DetallesPedido } from '../interface/detalle';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-editar-detalle',
  templateUrl: './editar-detalle.component.html',
})
export class EditarDetalleComponent implements OnInit {

  productos: any[] = [];
  pedidos: any[] = [];
  formulario: FormGroup;
  editar: boolean = false;
  detalleId: string | number | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private pedidosService: PedidoService,
    private productosService: ProductoService,
    private detalleService: DetallesService,
  ) {
    this.formulario = this.fb.group({
      id: [null],
      id_pedido: [null],
      id_producto: [null],
      cantidad: [1],
      precio_unitario: [0]
    });
  }

  ngOnInit(): void {
    forkJoin({
      pedidos: this.pedidosService.get(),
      productos: this.productosService.get()
    }).subscribe({
      next: ({ pedidos, productos }) => {
        this.pedidos = pedidos;
        this.productos = productos;

        this.activatedRoute.params.subscribe(params => {
          if (params['id']) {
            this.editar = true;
            this.detalleId = params['id'];
            this.cargarDetalle(params['id']);
          }
        });
      },
      error: (err) => console.error('Error cargando listas:', err)
    });
  }

  cargarDetalle(id: string) {
    this.detalleService.getId(id).subscribe({
      next: (detalle: DetallesPedido) => {
        this.formulario.patchValue(detalle);
      },
      error: (err) => {
        console.error('Error al cargar detalle:', err);
        this.router.navigate(['/admin/gestionar-detalles']);
      }
    });
  }

  guardar() {
    if (this.editar) {
      this.editarDetalle();
    } else {
      this.crearDetalle();
    }
  }

  crearDetalle() {
    const nuevoDetalle: DetallesPedido = this.formulario.value;
    delete nuevoDetalle.id;

    console.log("Detalle a crear:", nuevoDetalle);
    this.detalleService.post(nuevoDetalle).subscribe({
      next: () => {
        this.router.navigate(['/admin/gestionar-detalles']);
      },
      error: (error) => {
        console.error('Error al crear el detalle:', error);
      }
    });
  }

  editarDetalle() {
    const datosDetalle: DetallesPedido = this.formulario.value;

    if (this.detalleId) {
      datosDetalle.id = Number(this.detalleId);
    }

    console.log("Detalle a actualizar:", datosDetalle);

    this.detalleService.put(datosDetalle).subscribe({
      next: () => {
        this.router.navigate(['/admin/gestionar-detalles']);
      },
      error: (err) => {
        console.error('Error al actualizar el detalle:', err);
      }
    });
  }
}