import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { forkJoin } from 'rxjs';

import { PedidoService } from '../services/pedido';
import { Pedido } from '../interface/pedido';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { UsuarioService } from "../../usuarios/services/usuario";
import { MesaService } from "../../mesas/services/mesa";

declare var bootstrap: any;

@Component({
  selector: 'app-gestionar-pedido',
  templateUrl: './gestionar-pedido.component.html'
})
export class GestionarPedidoComponent implements OnInit {
  @ViewChild('modalBorrar') modalBorrarRef!: ElementRef;

  users: any[] = [];
  mesas: any[] = [];
  pedidos: Pedido[] = [];

  busqueda: string = '';
  estadoFiltro: string = '';
  criterioOrden: string = 'fecha';
  ordenAscendente: boolean = false;

  pedidoAEliminar: Pedido | null = null;
  private bsModal: any;

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly mesaService: MesaService,
    private readonly pedidoService: PedidoService,
    private readonly dialogService: DialogService
  ) {}

  ngOnInit(): void {
    forkJoin([
      this.usuarioService.get(),
      this.mesaService.get(),
      this.pedidoService.get()
    ]).subscribe(([users, mesas, pedidos]) => {
      this.users = users;
      this.mesas = mesas;
      this.pedidos = this.mapearPedidos(pedidos);
    });
  }

  cargarPedidos(): void {
    this.pedidoService.get().subscribe(data => {
      this.pedidos = this.mapearPedidos(data);
    });
  }

  private mapearPedidos(pedidos: Pedido[]): Pedido[] {
    return pedidos.map(pedido => ({
      ...pedido,
      usuario: this.users.find(u => u.id === pedido.id_user),
      mesa: this.mesas.find(m => m.id === pedido.id_mesa)
    }));
  }

  confirmarBorrado(pedido: Pedido): void {
    this.pedidoAEliminar = pedido;
    this.bsModal = new bootstrap.Modal(this.modalBorrarRef.nativeElement);
    this.bsModal.show();
  }

  cerrarModal(): void {
    if (this.bsModal) {
      this.bsModal.hide();
    }
    this.pedidoAEliminar = null;
  }

  ejecutarBorrado(): void {
    if (!this.pedidoAEliminar) return;

    this.pedidoService.del(this.pedidoAEliminar).subscribe(() => {
      this.dialogService.mostrarToast('Pedido eliminado correctamente');
      this.cerrarModal();
      this.cargarPedidos();
    });
  }

  get pedidosFiltradosYOrdenados(): Pedido[] {
    if (!this.pedidos) return [];

    let resultado = [...this.pedidos];

    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      resultado = resultado.filter(p => 
        p.usuario?.username?.toLowerCase().includes(q) ||
        p.tipo_pedido?.toLowerCase().includes(q) ||
        p.direccion_envio?.toLowerCase().includes(q) ||
        p.id?.toString().includes(q)
      );
    }

    if (this.estadoFiltro) {
      resultado = resultado.filter(p => p.estado?.toUpperCase() === this.estadoFiltro.toUpperCase());
    }

    resultado.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (this.criterioOrden) {
        case 'fecha':
          valA = new Date(a.fecha || 0).getTime();
          valB = new Date(b.fecha || 0).getTime();
          break;
        case 'total':
          valA = a.total || 0;
          valB = b.total || 0;
          break;
        case 'usuario':
          valA = a.usuario?.username?.toLowerCase() || '';
          valB = b.usuario?.username?.toLowerCase() || '';
          break;
        case 'estado':
          valA = a.estado?.toLowerCase() || '';
          valB = b.estado?.toLowerCase() || '';
          break;
      }

      if (valA < valB) return this.ordenAscendente ? -1 : 1;
      if (valA > valB) return this.ordenAscendente ? 1 : -1;
      return 0;
    });

    return resultado;
  }

  cambiarOrdenDireccion(): void {
    this.ordenAscendente = !this.ordenAscendente;
  }
}