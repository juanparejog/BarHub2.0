import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PerfilService } from '../perfil.service';

/**
 * Pestaña «Cuenta y correo»: nombre de usuario, correo y cambio de correo. El correo nuevo no entra
 * en la cuenta hasta que se abre el enlace que le enviamos; al actual le avisamos del cambio.
 */
@Component({
  selector: 'app-perfil-cuenta',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './perfil-cuenta.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilCuentaComponent {
  readonly perfil = inject(PerfilService);

  readonly nuevo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(100)]
  });
  readonly enviando = signal(false);
  readonly exito = signal('');
  readonly error = signal('');

  get invalido(): boolean {
    return this.nuevo.invalid && this.nuevo.touched;
  }

  solicitar(): void {
    this.exito.set('');
    this.error.set('');
    const correo = this.nuevo.value.trim();
    if (this.nuevo.invalid || !correo) {
      this.nuevo.markAsTouched();
      return;
    }
    this.enviando.set(true);
    this.perfil.cambiarCorreo(correo).subscribe({
      next: pendiente => {
        this.enviando.set(false);
        this.nuevo.reset();
        this.exito.set(`Te hemos enviado un enlace a ${pendiente}. Ábrelo para terminar el cambio.`);
      },
      error: err => {
        this.enviando.set(false);
        // Si se cancela la reautenticación, la petición termina con el 403 original: no es un fallo
        if (err?.error?.code !== 'REAUTENTICACION_REQUERIDA') {
          this.error.set(err?.error?.message ?? 'No se pudo enviar el enlace. Inténtalo de nuevo.');
        }
      }
    });
  }

  cancelar(): void {
    this.exito.set('');
    this.error.set('');
    this.perfil.cancelarCambioCorreo().subscribe({
      next: () => this.exito.set('Cambio de correo cancelado: el enlace enviado ya no sirve.'),
      error: () => this.error.set('No se pudo cancelar el cambio. Inténtalo de nuevo.')
    });
  }
}
