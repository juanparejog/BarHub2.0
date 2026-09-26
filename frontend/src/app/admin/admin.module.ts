import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { AdminRoutingModule } from './admin-routing.module';
import { UicomponentsModule } from '../uicomponents/uicomponents.module';

import { BienvenidaComponent } from './pages/bienvenida/bienvenida.component';
import { GestionarDetalleComponent } from './pages/detalles_pedidos/gestionar-detalles/gestionar-detalle.component';
import { VerDetalleComponent } from './pages/detalles_pedidos/ver-detalle/ver-detalle.component';
import { EditarDetalleComponent } from './pages/detalles_pedidos/editar-detalles/editar-detalles.component';
import { GestionarMesaComponent } from './pages/mesas/gestionar-mesas/gestionar-mesa.component';
import { VerMesaComponent } from './pages/mesas/ver-mesa/ver-mesa.component';
import { EditarMesaComponent } from './pages/mesas/editar-mesas/editar-mesas.component';
import { GestionarPagoComponent } from './pages/pagos/gestionar-pagos/gestionar-pago.component';
import { VerPagoComponent } from './pages/pagos/ver-pago/ver-pago.component';
import { EditarPagoComponent } from './pages/pagos/editar-pagos/editar-pagos.component';
import { GestionarPedidoComponent } from './pages/pedidos/gestionar-pedidos/gestionar-pedido.component';
import { VerPedidoComponent } from './pages/pedidos/ver-pedido/ver-pedido.component';
import { EditarPedidoComponent } from './pages/pedidos/editar-pedidos/editar-pedidos.component';
import { GestionarProductoComponent } from './pages/productos/gestionar-productos/gestionar-producto.component';
import { VerProductoComponent } from './pages/productos/ver-producto/ver-producto.component';
import { EditarProductoComponent } from './pages/productos/editar-productos/editar-productos.component';
import { GestionarUsuarioComponent } from './pages/usuarios/gestionar-usuarios/gestionar-usuario.component';
import { VerUsuarioComponent } from './pages/usuarios/ver-usuario/ver-usuario.component';
import { EditarUsuarioComponent } from './pages/usuarios/editar-usuarios/editar-usuarios.component';

@NgModule({
  declarations: [
    BienvenidaComponent,
    GestionarDetalleComponent,
    VerDetalleComponent,
    EditarDetalleComponent,
    GestionarMesaComponent,
    VerMesaComponent,
    EditarMesaComponent,
    GestionarPagoComponent,
    VerPagoComponent,
    EditarPagoComponent,
    GestionarPedidoComponent,
    VerPedidoComponent,
    EditarPedidoComponent,
    GestionarProductoComponent,
    VerProductoComponent,
    EditarProductoComponent,
    GestionarUsuarioComponent,
    VerUsuarioComponent,
    EditarUsuarioComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AdminRoutingModule,
    UicomponentsModule,
    FormsModule
  ]
})
export class AdminModule { }