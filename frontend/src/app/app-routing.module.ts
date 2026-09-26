import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { RoleGuard } from './auth/role.guard';
import { CartaComponent } from './public/carta/carta.component';
import { ContactoComponent } from './public/contacto/contacto.component';
import { ConfirmarPedidoComponent } from './public/confirmar-pedido/confirmar-pedido.component';
import { GestionarComandasComponent } from './public/gestionar-comandas/gestionar-comandas.component';
import { GestionarMesasEmpleadoComponent } from './public/gestionar-mesas-empleado/gestionar-mesas-empleado.component';
import { GestionarPagosEfectivoComponent } from './public/gestionar-pagos-efectivo/gestionar-pagos-efectivo.component';
import { HomeComponent } from './public/home/home.component';
import { SeguimientoPedidosComponent } from './public/seguimiento-pedidos/seguimiento-pedidos.component';
import { PoliticaPrivacidadComponent } from './public/politica-privacidad/politica-privacidad.component';
import { TerminosCondicionesComponent } from './public/terminos-condiciones/terminos-condiciones.component';

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) },
  { path: 'admin', loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule), },
  { path: 'admin', loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule), canActivate: [RoleGuard], data: { allowedRoles: ['ROLE_ADMIN'] } },
  { path: 'carta', component: CartaComponent },
  { path: 'confirmar-pedido', component: ConfirmarPedidoComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'empleado/gestionar-comandas', component: GestionarComandasComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } },
  { path: 'empleado/gestionar-mesas', component: GestionarMesasEmpleadoComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } },
  { path: 'empleado/gestionar-pagos', component: GestionarPagosEfectivoComponent, canActivate: [RoleGuard], data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } },
  { path: 'home', component: HomeComponent},
  { path: 'seguimiento-pedidos', component: SeguimientoPedidosComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'politica-privacidad', component: PoliticaPrivacidadComponent },
  { path: 'terminos-condiciones', component: TerminosCondicionesComponent },

  { path: '**', redirectTo: 'home'}
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forRoot(routes),
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule { }
