import { Component, OnInit, OnDestroy  } from '@angular/core';
import { PedidoService } from '../services/pedido';
import { Pedido } from '../interface/pedido';

@Component({
  selector: 'app-seguimiento-pedidos',
  templateUrl: './seguimiento-pedidos.component.html',
  styleUrls: ['./seguimiento-pedidos.component.css']
})
export class SeguimientoPedidosComponent implements OnInit, OnDestroy {
  pedidos: Pedido[] = [];
  usuario: any;
  private timers: any[] = [];

  constructor(private pedidoService: PedidoService) {}

  ngOnInit() {
    this.usuario = JSON.parse(localStorage.getItem('user') || 'null');
    if (this.usuario?.id) {
      this.pedidoService.getPedidosByUsuario(this.usuario.id).subscribe(data => {
        this.pedidos = data.filter(pedido => this.filtrarPedidosActivos(pedido));
        this.programarEliminaciones();
      });
    }
  }

  private filtrarPedidosActivos(pedido: Pedido): boolean {
    const ahora = new Date();
    const fechaPedido = new Date(pedido.fecha);
    const fechaLimite = new Date(fechaPedido);
    fechaLimite.setDate(fechaLimite.getDate() + 1);
    fechaLimite.setHours(0, 0, 0, 0);
    
    return ahora < fechaLimite;
  }

  private programarEliminaciones() {
    this.pedidos.forEach(pedido => {
      const fechaPedido = new Date(pedido.fecha);
      const fechaLimite = new Date(fechaPedido);
      fechaLimite.setDate(fechaLimite.getDate() + 1);
      fechaLimite.setHours(0, 0, 0, 0);
      
      const tiempoRestante = fechaLimite.getTime() - Date.now();
      
      if (tiempoRestante > 0) {
        const timer = setTimeout(() => {
          this.eliminarPedidoAutomatico(pedido);
        }, tiempoRestante);
        
        this.timers.push(timer);
      }
    });
  }

  private eliminarPedidoAutomatico(pedido: Pedido) {
    this.pedidoService.del(pedido).subscribe({
      next: () => {
        this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
      },
      error: () => console.error('Error eliminando pedido automáticamente')
    });
  }

  ngOnDestroy() {
    // Limpiar timers al destruir el componente
    this.timers.forEach(timer => clearTimeout(timer));
  }
}