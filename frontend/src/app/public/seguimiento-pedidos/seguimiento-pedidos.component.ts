import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, timer, of } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
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
    // Ya no dependemos estrictamente del id en la llamada, pero verificamos que esté logueado
    if (this.usuario) {
      this.iniciarRefrescoAutomatico();
    }
  }

  private iniciarRefrescoAutomatico() {
    // Consulta cada 5 segundos
    timer(0, 5000).pipe(
      switchMap(() => this.pedidoService.getMisPedidos().pipe(
        catchError(err => {
          console.error('Error al obtener mis pedidos:', err);
          return of([]); // Retorna array vacío si falla para mantener el timer activo
        })
      )),
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
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];

    this.pedidos.forEach(pedido => {
      const fechaPedido = new Date(pedido.fecha);
      const fechaLimite = new Date(fechaPedido);
      fechaLimite.setDate(fechaLimite.getDate() + 1);
      fechaLimite.setHours(0, 0, 0, 0);
      
      const tiempoRestante = fechaLimite.getTime() - Date.now();
      
      if (tiempoRestante > 0) {
        const t = setTimeout(() => {
          this.eliminarPedidoAutomatico(pedido);
        }, tiempoRestante);
        
        this.timers.push(t);
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
    this.timers.forEach(t => clearTimeout(t));
  }
}