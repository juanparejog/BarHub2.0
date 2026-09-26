import { Component, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { UsuarioService } from "../../usuarios/services/usuario";
import { MesaService } from "../../mesas/services/mesa";
import { Pedido } from '../interface/pedido';
import { PedidoService } from '../services/pedido';

@Component({
  selector: 'app-ver-pedido',
  templateUrl: './ver-pedido.component.html'
})
export class VerPedidoComponent implements OnInit {
  users: any[] = [];
  mesas: any[] = [];
  pedido!: Pedido;

  constructor(
    private pedidoService: PedidoService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarPedido();
  }
  
  cargarPedido() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => {
          return this.pedidoService.getId(id);
        }),
      )
      .subscribe(
        pedido => {
          this.pedido = pedido;
          console.log('Pedido cargado:', this.pedido);
        },
        error => {
          console.error('Error al cargar la pedido:', error);
        }
      );
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