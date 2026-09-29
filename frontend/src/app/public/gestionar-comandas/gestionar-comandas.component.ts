import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { DetallesService } from '../../admin/pages/detalles_pedidos/services/detalle';
import { PedidoService } from '../../admin/pages/pedidos/services/pedido';
import { Pedido } from '../../admin/pages/pedidos/interface/pedido';

@Component({
  selector: 'app-gestionar-comandas',
  templateUrl: './gestionar-comandas.component.html',
  styleUrls: ['./gestionar-comandas.component.css']
})
export class GestionarComandasComponent implements OnInit, OnDestroy {
  pedidos: Pedido[] = [];
  estados = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'preparado', label: 'Preparado' },
    { value: 'servido', label: 'Servido' }
  ];
  
  private destroy$ = new Subject<void>();

  constructor(
    private detalleService: DetallesService, 
    private pedidoService: PedidoService
  ) {}

  ngOnInit() {
    this.iniciarRefrescoAutomatico();
  }

  iniciarRefrescoAutomatico() {
    // Consulta los pedidos cada 5 segundos
    timer(0, 5000).pipe(
      switchMap(() => this.pedidoService.get()),
      takeUntil(this.destroy$)
    ).subscribe(pedidos => {
      const sinServir = pedidos.filter(p => p.estado !== 'servido');
      
      sinServir.forEach(pedido => {
        this.detalleService.getByPedidoId(pedido.id!).subscribe(detalles => {
          pedido.detalles = detalles;
        });
      });

      this.pedidos = sinServir;
    });
  }

  cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    if (pedido.estado === nuevoEstado) return;
    
    const actualizado = { ...pedido, estado: nuevoEstado };
    this.pedidoService.put(actualizado).subscribe({
      next: () => {
        pedido.estado = nuevoEstado;
        // Si el estado pasa a servido, lo eliminamos localmente de inmediato
        if (nuevoEstado === 'servido') {
          this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
        }
      },
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}