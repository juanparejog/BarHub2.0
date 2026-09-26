import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ReactiveFormsModule } from '@angular/forms';
import { DetallesService } from '../services/detalle';
import { PedidoService } from '../../pedidos/services/pedido';
import { ProductoService } from '../../productos/services/producto';
import { DetallesPedido } from '../interface/detalle';

@Component({
    selector: 'app-editar-detalle',
    templateUrl: './editar-detalle.component.html',
  })
  export class EditarDetalleComponent implements OnInit {
  
    productos: any[] = [];
    pedidos: any[] = [];
    formulario: FormGroup;
    editar: boolean = false;
  
    ngOnInit(): void {
      this.pedidosService.get().subscribe(data => this.pedidos = data);
      this.productosService.get().subscribe(data => this.productos = data);
  
      this.activatedRoute.params.subscribe(params => {
        if (params['id']) {
          this.editar = true;
          this.cargarDetalle(params['id']);
        }
      });
    }
  
    constructor(
      private activatedRoute: ActivatedRoute,
      private fb: FormBuilder,
      private router: Router,
      private pedidosService: PedidoService,
      private productosService: ProductoService,
      private detalleService: DetallesService,
    ) {
      // Inicializa el formulario en el constructor
      this.formulario = this.fb.group({
        id_pedido: [null],
        id_producto: [null],
        cantidad: [1],
        precio_unitario: [0]
      });
    }
  
    guardar() {
      if (this.editar && this.formulario.get('id')?.value > 0) {
        this.editarDetalle();
      } else {
        this.crearDetalle();
      }
    }
  
    cargarDetalle(id: string) {
      this.detalleService.getId(id).subscribe({
        next: (detalle: DetallesPedido) => {
          this.formulario.patchValue(detalle);
        },
        error: () => {
          this.router.navigate(['/admin/gestionar-detalles']);
        }
      });
    }
  
    crearDetalle() {
      const nuevoDetalle: DetallesPedido = this.formulario.value;
      console.log("Detalle a enviar:", nuevoDetalle);
      this.detalleService.post(nuevoDetalle).subscribe(
        response => {
          this.router.navigate(['/admin/gestionar-detalles']);
        },
        error => {
          console.error('Error al crear el detalle:', error);
        });
    }
  
    editarDetalle() {
      const datosDetalle = this.formulario.value;
      this.detalleService.put(datosDetalle).subscribe({
        next: (response) => {
          this.router.navigate(['/admin/gestionar-detalles']);
        },
        error: (err) => {
          console.error('Error en la petición PUT:', err);
        }
      });
    }  
  }