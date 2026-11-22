import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ConfirmarCorreoComponent } from './correo/confirmar-correo.component';
import { RecuperarComponent } from './correo/recuperar.component';
import { RestablecerComponent } from './correo/restablecer.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  // Enlaces de los correos (el token va en el fragmento: #token=...)
  { path: 'verificar', component: ConfirmarCorreoComponent },
  { path: 'recuperar', component: RecuperarComponent },
  { path: 'restablecer', component: RestablecerComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule {}