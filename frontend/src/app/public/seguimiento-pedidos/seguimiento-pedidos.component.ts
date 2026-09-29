import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
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
  private destroy$ = new Subject<void>();
  private timers: any[] = [];

  constructor(private pedidoService: PedidoService) {}

  ngOnInit() {
    this.usuario = JSON.parse(localStorage.getItem('user') || 'null');
    if (this.usuario?.id) {
      this.iniciarRefrescoAutomatico();
    }
  }

  private iniciarRefrescoAutomatico() {
    // Consulta cada 5 segundos
    timer(0, 5000).pipe(
      switchMap(() => this.pedidoService.getPedidosByUsuario(this.usuario.id)),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.pedidos = data.filter(pedido => this.filtrarPedidosActivos(pedido));
      this.programarEliminaciones();
    });
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
    // Limpiamos los timers anteriores para no duplicar
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];

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
    this.destroy$.next();
    this.destroy$.complete();
    this.timers.forEach(timer => clearTimeout(timer));
  }
}