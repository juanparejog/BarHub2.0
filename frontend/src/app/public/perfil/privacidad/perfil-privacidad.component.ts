import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../auth/auth.service';
import { DialogService } from '../../../main/services/shared/services/dialog.service';
import { PerfilService } from '../perfil.service';

const ROLES_PERSONAL = ['ROLE_ADMIN', 'ROLE_EMPLEADO'];

/**
 * Pestaña «Privacidad»: descargar los datos de la cuenta (JSON) y eliminarla. Eliminar borra los datos
 * personales y deja los pedidos sin nada que identifique a la persona. Solo para clientes: al personal
 * lo da de baja el administrador.
 */
@Component({
  selector: 'app-perfil-privacidad',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './perfil-privacidad.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilPrivacidadComponent {
  readonly perfil = inject(PerfilService);
  private readonly authService = inject(AuthService);
  private readonly dialogo = inject(DialogService);

  readonly descargando = signal(false);
  readonly errorDescarga = signal('');
  readonly eliminando = signal(false);
  readonly errorEliminar = signal('');

  /** Para confirmar hay que escribir el nombre de usuario. */
  readonly confirmacion = new FormControl('', { nonNullable: true });
  private readonly escrito = toSignal(this.confirmacion.valueChanges, { initialValue: '' });

  readonly esPersonal = computed(() =>
    (this.perfil.usuario()?.roles ?? []).some(r => ROLES_PERSONAL.includes(r.nombre)));
  readonly confirmado = computed(() => {
    const usuario = this.perfil.usuario()?.username;
    return !!usuario && this.escrito().trim() === usuario;
  });

  descargar(): void {
    if (this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.errorDescarga.set('');
    this.perfil.descargarDatos().subscribe({
      next: () => this.descargando.set(false),
      error: err => {
        this.descargando.set(false);
        // Si se cancela la reautenticación, la petición termina con el 403 original: no es un fallo
        if (err?.error?.code !== 'REAUTENTICACION_REQUERIDA') {
          this.errorDescarga.set('No se pudieron descargar tus datos. Inténtalo de nuevo.');
        }
      }
    });
  }

  eliminar(): void {
    if (!this.confirmado() || this.eliminando() || this.esPersonal()) {
      return;
    }
    this.eliminando.set(true);
    this.errorEliminar.set('');
    this.perfil.eliminarCuenta().subscribe({
      next: () => {
        this.dialogo.mostrarToast('Tu cuenta se ha eliminado. Gracias por haber usado BarHub.');
        this.authService.logout();
      },
      error: err => {
        this.eliminando.set(false);
        if (err?.error?.code !== 'REAUTENTICACION_REQUERIDA') {
          this.errorEliminar.set(err?.error?.message ?? 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
        }
      }
    });
  }
}
