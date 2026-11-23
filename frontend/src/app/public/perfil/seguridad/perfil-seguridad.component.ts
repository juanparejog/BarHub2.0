import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PerfilDosFactoresComponent } from './perfil-dos-factores.component';
import { PerfilPasswordComponent } from './perfil-password.component';
import { PerfilSesionesComponent } from './perfil-sesiones.component';

/** Pestaña «Seguridad»: contraseña, verificación en dos pasos y sesiones abiertas. */
@Component({
  selector: 'app-perfil-seguridad',
  standalone: true,
  imports: [PerfilPasswordComponent, PerfilDosFactoresComponent, PerfilSesionesComponent],
  template: `
    <h2 class="h5 fw-bold mb-1"><i class="bi bi-shield-lock text-indigo me-2" aria-hidden="true"></i>Seguridad</h2>
    <p class="text-muted font-size-14 mb-4">Cómo entras en tu cuenta y dónde la tienes abierta.</p>
    <section class="bloque-perfil" aria-label="Contraseña"><app-perfil-password /></section>
    <section class="bloque-perfil" aria-label="Verificación en dos pasos"><app-perfil-dos-factores /></section>
    <section class="bloque-perfil" aria-label="Sesiones abiertas"><app-perfil-sesiones /></section>
  `,
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilSeguridadComponent {
}
