import { Component, OnInit } from '@angular/core';
import { PedidoService } from '../services/pedido';
import { Pedido } from '../interface/pedido';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { UsuarioService } from "../../usuarios/services/usuario";
import { MesaService } from "../../mesas/services/mesa";
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-gestionar-pedido',
  templateUrl: './gestionar-pedido.component.html'
})
export class GestionarPedidoComponent implements OnInit {
  users: any[] = [];
  mesas: any[] = [];
  pedidos: Pedido[] = [];

  constructor(
    private usuarioService: UsuarioService,
    private mesaService: MesaService,
    private pedidoService: PedidoService,
    private dialogService: DialogService,
  ) { }

  ngOnInit(): void {
    forkJoin([
      this.usuarioService.get(),
      this.mesaService.get(),
      this.pedidoService.get()
    ]).subscribe(([users, mesas, pedidos]) => {
      this.users = users;
      this.mesas = mesas;
      this.pedidos = pedidos.map(pedido => ({
        ...pedido,
        usuario: this.users.find(u => u.id === pedido.id_user),
        mesa: this.mesas.find(m => m.id === pedido.id_mesa)
      }));
      console.log("Pedidos cargados:", this.pedidos);
    });
  }

  cargarPedidos() {
    this.pedidoService.get().subscribe(data => {
      this.pedidos = data.map(pedido => ({
        ...pedido,
        usuario: this.users.find(u => u.id === pedido.id_user),
        mesa: this.mesas.find(m => m.id === pedido.id_mesa)
      }));
      console.log("Pedidos cargados:", this.pedidos);
    });
  }  

  borrarPedido(pedido: Pedido) {
    this.dialogService.solicitarConfirmacion('¿Está seguro de que desea eliminar el pedido?',
       'Eliminar pedido', 
      () => {
      this.pedidoService.del(pedido)
        .subscribe(() => {
          this.dialogService.mostrarToast('Pedido eliminado correctamente');
          this.cargarPedidos();
        });
    });
  }

  getUserName(id_user: number | null | undefined): string {
    if (id_user === null || id_user === undefined) return 'Usuario no encontrado';
    const user = this.users.find(u => u.id === id_user);
    console.log(id_user);
    return user ? user.nombre : id_user.toString();
  }
  
  getMesaCodigo(id_mesa: number | null | undefined): string {
    if (id_mesa === null || id_mesa === undefined) return 'Mesa no encontrada';
    const mesa = this.mesas.find(m => m.id === id_mesa);
    console.log(id_mesa);
    return mesa ? mesa.codigoqr : id_mesa.toString();
  }
}