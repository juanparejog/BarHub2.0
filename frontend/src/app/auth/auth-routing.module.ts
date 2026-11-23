import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ConfirmarCorreoComponent } from './correo/confirmar-correo.component';
import { RecuperarComponent } from './correo/recuperar.component';
import { RestablecerComponent } from './correo/restablecer.component';
import { ConfirmarCambioCorreoComponent } from './correo/confirmar-cambio-correo.component';
import { DosFactoresComponent } from './dos-factores/dos-factores.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  // Segundo paso del login (el desafio llega en el estado del historial)
  { path: '2fa', component: DosFactoresComponent },
  // Enlaces de los correos (el token va en el fragmento: #token=...)
  { path: 'verificar', component: ConfirmarCorreoComponent },
  { path: 'recuperar', component: RecuperarComponent },
  { path: 'restablecer', component: RestablecerComponent },
  { path: 'confirmar-cambio-correo', component: ConfirmarCambioCorreoComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule {}