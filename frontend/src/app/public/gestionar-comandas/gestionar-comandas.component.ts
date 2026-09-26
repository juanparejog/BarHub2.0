import { Component, OnInit } from '@angular/core';
import { PagoService } from '../../admin/pages/pagos/services/pago';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';
import { DetallesPedido } from '../../admin/pages/detalles_pedidos/interface/detalle';
import { Pago } from '../../admin/pages/pagos/interface/pago';
import { Pedido } from '../../admin/pages/pedidos/interface/pedido';

@Component({
  selector: 'app-gestionar-comandas',
  templateUrl: './gestionar-comandas.component.html',
  styleUrls: ['./gestionar-comandas.component.css']
})
export class GestionarComandasComponent implements OnInit {
  pedidos: Pedido[] = [];
  detalles: DetallesPedido[] = [];
  estados = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'preparado', label: 'Preparado' },
    { value: 'servido', label: 'Servido' }
  ];

  constructor(private detalleService: DetallesService, private pagoService: PagoService, private pedidoService: PedidoService) {}

  ngOnInit() {
    this.cargarPedidos();
  }


  cargarPedidos() {
    this.pedidoService.get().subscribe(pedidos => {
        this.pedidos = pedidos.filter(p => p.estado !== 'servido');
        this.pedidos.forEach(pedido => {
            this.detalleService.getByPedidoId(pedido.id!).subscribe(detalles => {
                pedido.detalles = detalles;
            });      
        });
    });
  }


  cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    if (pedido.estado === nuevoEstado) return;
    const actualizado = { ...pedido, estado: nuevoEstado };
    this.pedidoService.put(actualizado).subscribe({
      next: () => pedido.estado = nuevoEstado,
      error: () => alert('Error actualizando el estado del pedido')
    });
  }

  getLabelEstado(estado: string): string {
    const encontrado = this.estados.find(e => e.value === estado);
    return encontrado ? encontrado.label : 'Desconocido';
  }
  
  get pedidosNoServidos(): Pedido[] {
    return this.pedidos.filter(pedido => pedido.estado !== 'servido');
  }

}