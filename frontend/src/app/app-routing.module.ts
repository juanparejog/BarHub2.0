import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { RoleGuard } from './auth/role.guard';

import { CartaComponent } from './public/carta/carta.component';
import { ContactoComponent } from './public/contacto/contacto.component';
import { ConfirmarPedidoComponent } from './public/confirmar-pedido/confirmar-pedido.component';
import { GestionarCajaComponent } from './public/gestionar-caja/gestionar-caja.component';
import { GestionarComandasComponent } from './public/gestionar-comandas/gestionar-comandas.component';
import { GestionarMesasEmpleadoComponent } from './public/gestionar-mesas-empleado/gestionar-mesas-empleado.component';
import { GestionarPagosEfectivoComponent } from './public/gestionar-pagos-efectivo/gestionar-pagos-efectivo.component';
import { HomeComponent } from './public/home/home.component';
import { SeguimientoPedidosComponent } from './public/seguimiento-pedidos/seguimiento-pedidos.component';
import { PoliticaPrivacidadComponent } from './public/politica-privacidad/politica-privacidad.component';
import { TerminosCondicionesComponent } from './public/terminos-condiciones/terminos-condiciones.component';
import { PerfilComponent } from './public/perfil/perfil.component';
import { PerfilDatosComponent } from './public/perfil/datos/perfil-datos.component';
import { PerfilDireccionComponent } from './public/perfil/direccion/perfil-direccion.component';
import { PerfilSeguridadComponent } from './public/perfil/seguridad/perfil-seguridad.component';
import { PerfilCuentaComponent } from './public/perfil/cuenta/perfil-cuenta.component';
import { PerfilPrivacidadComponent } from './public/perfil/privacidad/perfil-privacidad.component';

const routes: Routes = [
  // Ruta por defecto
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Módulos perezosos (Lazy Loading)
  { path: 'auth', loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) },
  { 
    path: 'admin', 
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [RoleGuard], 
    data: { roles: ['ROLE_ADMIN'] } 
  },

  // Rutas Públicas y Clientes
  { path: 'home', component: HomeComponent },
  { path: 'carta', component: CartaComponent },
  { path: 'confirmar-pedido', component: ConfirmarPedidoComponent },
  { path: 'seguimiento-pedidos', component: SeguimientoPedidosComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'politica-privacidad', component: PoliticaPrivacidadComponent },
  { path: 'terminos-condiciones', component: TerminosCondicionesComponent },
  {
    path: 'perfil', component: PerfilComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'datos' },
      { path: 'datos', component: PerfilDatosComponent },
      { path: 'direccion', component: PerfilDireccionComponent },
      { path: 'cuenta', component: PerfilCuentaComponent },
      { path: 'seguridad', component: PerfilSeguridadComponent },
      { path: 'privacidad', component: PerfilPrivacidadComponent }
    ]
  },

  // Rutas Empleados / Personal
  { 
    path: 'empleado/gestionar-comandas', 
    component: GestionarComandasComponent, 
    canActivate: [RoleGuard], 
    data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } 
  },
  { 
    path: 'empleado/gestionar-mesas', 
    component: GestionarMesasEmpleadoComponent, 
    canActivate: [RoleGuard], 
    data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } 
  },
  { 
    path: 'empleado/gestionar-pagos', 
    component: GestionarPagosEfectivoComponent, 
    canActivate: [RoleGuard], 
    data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } 
  },
  { 
    path: 'empleado/gestionar-caja', 
    component: GestionarCajaComponent, 
    canActivate: [RoleGuard], 
    data: { roles: ['ROLE_EMPLEADO', 'ROLE_ADMIN'] } 
  },

  // Comodín para URLs no encontradas
  { path: '**', redirectTo: 'home' }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forRoot(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule { }