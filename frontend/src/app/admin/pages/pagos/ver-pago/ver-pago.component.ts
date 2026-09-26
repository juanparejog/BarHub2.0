import { Component, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Pago } from '../interface/pago';
import { PagoService } from '../services/pago';
import { PedidoService } from "../../pedidos/services/pedido";

@Component({
  selector: 'app-ver-pago',
  templateUrl: './ver-pago.component.html'
})
export class VerPagoComponent implements OnInit {

  pago!: Pago;
  pedidos: any[] = [];

  constructor(
    private pagoService: PagoService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarPago();
  }
  
  cargarPago() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => {
          return this.pagoService.getId(id);
        }),
      )
      .subscribe(
        pago => {
          this.pago = pago;
          console.log('Pago cargado:', this.pago);
        },
        error => {
          console.error('Error al cargar la pago:', error);
        }
      );
  }   
  
  getPedidoCodigo(id_pedido: number | null | undefined): string {
    if (id_pedido === null || id_pedido === undefined) return 'Pedido no encontrado';
    const pedido = this.pedidos?.find(p => p.id === id_pedido);
    return pedido ? pedido.id?.toString() ?? '' : `ID: ${id_pedido}`;
  }
}