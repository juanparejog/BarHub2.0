import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap } from "rxjs";
import { PedidoService } from "../services/pedido";
import { Pedido } from "../interface/pedido";
import { UsuarioService } from "../../usuarios/services/usuario";
import { MesaService } from "../../mesas/services/mesa";


@Component({
  selector: 'app-editar-pedido',
  templateUrl: './editar-pedido.component.html',
})
export class EditarPedidoComponent implements OnInit {

  users: any[] = [];
  mesas: any[] = [];
  formulario: FormGroup;
  editar: boolean = false;

  ngOnInit(): void {
    this.usuarioService.get().subscribe(data => this.users = data);
    this.mesaService.get().subscribe(data => this.mesas = data);

    this.activatedRoute.params.subscribe(params => {
      if (params['id']) {
        this.editar = true;
        this.cargarPedido(params['id']);
      }
    });
  }

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private usuarioService: UsuarioService,
    private mesaService: MesaService,
    private pedidoService: PedidoService,
  ) {
    // Inicializa el formulario en el constructor
    this.formulario = this.fb.group({
      id_user: [null],
      id_mesa: [null],
      estado: ['pendiente'],
      fecha: [new Date().toISOString().split('T')[0]],
      total: [0]
    });
  }

  guardar() {
    if (this.editar && this.formulario.get('id')?.value > 0) {
      this.editarPedido();
    } else {
      this.crearPedido();
    }
  }

  cargarPedido(id: string) {
    this.pedidoService.getId(id).subscribe({
      next: (pedido: Pedido) => {
        this.formulario.patchValue(pedido);
      },
      error: () => {
        this.router.navigate(['/admin/gestionar-pedidos']);
      }
    });
  }

  crearPedido() {
    const nuevoPedido: Pedido = this.formulario.value;
    console.log("Pedido a enviar:", nuevoPedido);
    this.pedidoService.post(nuevoPedido).subscribe(
      response => {
        this.router.navigate(['/admin/gestionar-pedidos']);
      },
      error => {
        console.error('Error al crear el pedido:', error);
      });
  }

  editarPedido() {
    const datosPedido = this.formulario.value;
    this.pedidoService.put(datosPedido).subscribe({
      next: (response) => {
        this.router.navigate(['/admin/gestionar-pedidos']);
      },
      error: (err) => {
        console.error('Error en la petición PUT:', err);
      }
    });
  }  
}