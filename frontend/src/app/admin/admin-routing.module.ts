import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoleGuard } from '../auth/role.guard';

// Ruta Bienvenida Admin
import { BienvenidaComponent } from './pages/bienvenida/bienvenida.component';

// Rutas Mesas
import { GestionarDetalleComponent } from './pages/detalles_pedidos/gestionar-detalles/gestionar-detalle.component';
import { EditarDetalleComponent } from './pages/detalles_pedidos/editar-detalles/editar-detalles.component';
import { VerDetalleComponent } from './pages/detalles_pedidos/ver-detalle/ver-detalle.component';

// Rutas Mesas
import { EditarMesaComponent } from './pages/mesas/editar-mesas/editar-mesas.component';
import { GestionarMesaComponent } from './pages/mesas/gestionar-mesas/gestionar-mesa.component';
import { VerMesaComponent } from './pages/mesas/ver-mesa/ver-mesa.component';

// Rutas Pagos
import { EditarPagoComponent } from './pages/pagos/editar-pagos/editar-pagos.component';
import { GestionarPagoComponent } from './pages/pagos/gestionar-pagos/gestionar-pago.component';
import { VerPagoComponent } from './pages/pagos/ver-pago/ver-pago.component';

// Rutas Pedidos
import { EditarPedidoComponent } from './pages/pedidos/editar-pedidos/editar-pedidos.component';
import { GestionarPedidoComponent } from './pages/pedidos/gestionar-pedidos/gestionar-pedido.component';
import { VerPedidoComponent } from './pages/pedidos/ver-pedido/ver-pedido.component';

// Rutas Productos
import { EditarProductoComponent } from './pages/productos/editar-productos/editar-productos.component';
import { GestionarProductoComponent } from './pages/productos/gestionar-productos/gestionar-producto.component';
import { VerProductoComponent } from './pages/productos/ver-producto/ver-producto.component';

// Rutas Usuarios
import { EditarUsuarioComponent } from './pages/usuarios/editar-usuarios/editar-usuarios.component';
import { GestionarUsuarioComponent } from './pages/usuarios/gestionar-usuarios/gestionar-usuario.component';
import { VerUsuarioComponent } from './pages/usuarios/ver-usuario/ver-usuario.component';

const routes: Routes = [
  {
    path: '',
    canActivate: [RoleGuard],
    data: { roles: ['ROLE_ADMIN'] },
    children: [
      { path: '', component: BienvenidaComponent },

      // Detalles de los pedidos
      { path: 'crear-detalle', component: EditarDetalleComponent },
      { path: 'editar-detalle/:id', component: EditarDetalleComponent },
      { path: 'gestionar-detalles', component: GestionarDetalleComponent },
      { path: 'ver-detalle/:id', component: VerDetalleComponent },

      // Mesas
      { path: 'crear-mesa', component: EditarMesaComponent },
      { path: 'editar-mesas/:id', component: EditarMesaComponent },
      { path: 'gestionar-mesas', component: GestionarMesaComponent },
      { path: 'ver-mesa/:id', component: VerMesaComponent },

      // Pagos
      { path: 'crear-pago', component: EditarPagoComponent },
      { path: 'editar-pago/:id', component: EditarPagoComponent },
      { path: 'gestionar-pagos', component: GestionarPagoComponent },
      { path: 'ver-pago/:id', component: VerPagoComponent },

      // Pedidos
      { path: 'crear-pedido', component: EditarPedidoComponent },
      { path: 'editar-pedido/:id', component: EditarPedidoComponent },
      { path: 'gestionar-pedidos', component: GestionarPedidoComponent },
      { path: 'ver-pedido/:id', component: VerPedidoComponent },

      // Productos
      { path: 'crear-producto', component: EditarProductoComponent },
      { path: 'editar-productos/:id', component: EditarProductoComponent },
      { path: 'gestionar-productos', component: GestionarProductoComponent },
      { path: 'ver-producto/:id', component: VerProductoComponent },

      // Usuarios
      { path: 'crear-usuario', component: EditarUsuarioComponent },
      { path: 'editar-usuarios/:id', component: EditarUsuarioComponent },
      { path: 'gestionar-usuarios', component: GestionarUsuarioComponent },
      { path: 'ver-usuario/:id', component: VerUsuarioComponent },

      { path: '**', redirectTo: '' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
