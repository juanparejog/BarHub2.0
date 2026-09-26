import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap } from "rxjs";
import { PagoService } from "../services/pago";
import { Pago } from "../interface/pago";
import { PedidoService } from "../../pedidos/services/pedido";


@Component({
  selector: 'app-editar-pago',
  templateUrl: './editar-pago.component.html',
})
export class EditarPagoComponent implements OnInit {

  pedidos: any[] = [];
  formulario: FormGroup;
  editar: boolean = false;

  ngOnInit(): void {
    this.pedidoService.get().subscribe(data => this.pedidos = data);

    this.activatedRoute.params.subscribe(params => {
      if (params['id']) {
        this.editar = true;
        this.cargarPago(params['id']);
      }
    });
  }

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private pagoService: PagoService,
    private pedidoService: PedidoService,
  ) {
    // Inicializa el formulario en el constructor
    this.formulario = this.fb.group({
      id_pedido: [null],
      metodo_pago: ['efectivo'],
      estado_pago: ['pendiente'],
      total: [0],
      fecha_pago: [new Date().toISOString().split('T')[0]],
    });
  }

  guardar() {
    if (this.editar && this.formulario.get('id')?.value > 0) {
      this.editarPago();
    } else {
      this.crearPago();
    }
  }

  cargarPago(id: string) {
    this.pagoService.getId(id).subscribe({
      next: (pago: Pago) => {
        this.formulario.patchValue(pago);
      },
      error: () => {
        this.router.navigate(['/admin/gestionar-pagos']);
      }
    });
  }

  crearPago() {
    const nuevoPago: Pago = this.formulario.value;
    console.log("Pago a enviar:", nuevoPago);
    this.pagoService.post(nuevoPago).subscribe(
      response => {
        this.router.navigate(['/admin/gestionar-pagos']);
      },
      error => {
        console.error('Error al crear el pago:', error);
      });
  }

  editarPago() {
    const datosPago = this.formulario.value;
    this.pagoService.put(datosPago).subscribe({
      next: (response) => {
        this.router.navigate(['/admin/gestionar-pagos']);
      },
      error: (err) => {
        console.error('Error en la petición PUT:', err);
      }
    });
  }  
}