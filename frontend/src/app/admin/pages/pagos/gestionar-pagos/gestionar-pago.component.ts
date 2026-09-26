import { Component, OnInit } from '@angular/core';
import { PagoService } from '../services/pago';
import { Pago } from '../interface/pago';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { PedidoService } from "../../pedidos/services/pedido";
import { tap } from 'rxjs';

@Component({
  selector: 'app-gestionar-pago',
  templateUrl: './gestionar-pago.component.html'
})
export class GestionarPagoComponent implements OnInit {
  pedidos: any[] = [];
  pagos: Pago[] = [];

  constructor(
    private pagoService: PagoService,
    private pedidoService: PedidoService,
    private dialogService: DialogService,
  ) { }

  ngOnInit(): void {
    this.pedidoService.get().subscribe(data => this.pedidos = data);
    
    this.cargarPagos();
  }

  cargarPagos() {
    this.pagoService.get().subscribe(data => {
      this.pagos = data.map(pago => ({
        ...pago,
        pedido: this.pedidos.find(p => p.id === pago.id_pedido),
      }));
      console.log("Pagos cargados:", this.pagos);
    });
  }  

  borrarPago(pago: Pago) {
    this.dialogService.solicitarConfirmacion('¿Está seguro de que desea eliminar el pago?',
       'Eliminar pago', 
      () => {
      this.pagoService.del(pago)
        .subscribe(() => {
          this.dialogService.mostrarToast('Pago eliminado correctamente');
          this.cargarPagos();
        });
    });
  }

  getPedidoCodigo(id_pedido: number | null | undefined): string {
    if (id_pedido === null || id_pedido === undefined) return 'Pedido no encontrado';
    const pedido = this.pedidos?.find(p => p.id === id_pedido);
    return pedido ? pedido.id?.toString() ?? '' : `ID: ${id_pedido}`;
  }
}