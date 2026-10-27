import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
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
  formulario!: FormGroup;
  editar: boolean = false;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly usuarioService: UsuarioService,
    private readonly mesaService: MesaService,
    private readonly pedidoService: PedidoService,
  ) {
    this.crearFormulario();
  }

  ngOnInit(): void {
    this.usuarioService.get().subscribe(data => this.users = data);
    this.mesaService.get().subscribe(data => this.mesas = data);

    this.escucharTipoPedido();

    this.activatedRoute.params.subscribe(params => {
      if (params['id']) {
        this.editar = true;
        this.cargarPedido(params['id']);
      }
    });
  }

  crearFormulario() {
    this.formulario = this.fb.group({
      id: [null],
      id_user: [null, Validators.required],
      tipo_pedido: ['recoger', Validators.required],
      id_mesa: [null],
      direccion_envio: [''],
      direccion_tienda: ['Local Principal'],
      estado: ['pendiente', Validators.required],
      fecha: [new Date().toISOString().split('T')[0], Validators.required],
      total: [0, [Validators.required, Validators.min(0)]]
    });
  }

  escucharTipoPedido() {
    this.formulario.get('tipo_pedido')?.valueChanges.subscribe(tipo => {
      const tipoNormalizado = tipo?.toLowerCase();
      
      if (tipoNormalizado === 'recoger') {
        this.formulario.patchValue({ id_mesa: null, direccion_envio: '' }, { emitEvent: false });
      } else if (tipoNormalizado === 'domicilio') {
        this.formulario.patchValue({ id_mesa: null, direccion_tienda: '' }, { emitEvent: false });
      } else if (tipoNormalizado === 'mesa') {
        this.formulario.patchValue({ direccion_envio: '', direccion_tienda: '' }, { emitEvent: false });
      }
    });
  }

  cargarPedido(id: string) {
    this.pedidoService.getId(id).subscribe({
      next: (pedido: Pedido) => {
        if (pedido.tipo_pedido) {
          pedido.tipo_pedido = pedido.tipo_pedido.toLowerCase() as any;
        }
        this.formulario.patchValue(pedido);
      },
      error: (err) => {
        console.error('Error al cargar el pedido:', err);
        void this.router.navigate(['/admin/gestionar-pedidos']);
      }
    });
  }

  guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const rawData = this.formulario.value;
    const tipo = rawData.tipo_pedido?.toLowerCase();

    const pedidoAEnviar: Pedido = {
      ...rawData,
      tipo_pedido: tipo,
      id_mesa: tipo === 'mesa' ? rawData.id_mesa : null,
      direccion_envio: tipo === 'domicilio' ? rawData.direccion_envio : null,
      direccion_tienda: tipo === 'recoger' ? (rawData.direccion_tienda || 'Local Principal') : null
    };

    if (this.editar && rawData.id) {
      this.editarPedido(pedidoAEnviar);
    } else {
      this.crearPedido(pedidoAEnviar);
    }
  }

  crearPedido(pedido: Pedido) {
    this.pedidoService.post(pedido).subscribe({
      next: () => {
        void this.router.navigate(['/admin/gestionar-pedidos']);
      },
      error: (err) => {
        console.error('Error al crear el pedido:', err);
      }
    });
  }

  editarPedido(pedido: Pedido) {
    this.pedidoService.put(pedido).subscribe({
      next: () => {
        void this.router.navigate(['/admin/gestionar-pedidos']);
      },
      error: (err) => {
        console.error('Error al actualizar el pedido:', err);
      }
    });
  }
}