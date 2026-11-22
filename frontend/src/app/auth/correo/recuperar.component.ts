import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

/** "He olvidado mi contrasena": pide el correo y envia el enlace para elegir una nueva. */
@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recuperar.component.html',
  styleUrls: ['./cuenta-correo.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class RecuperarComponent {
  private readonly authService = inject(AuthService);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] })
  });
  enviando = false;
  enviado = false;
  mensaje = '';
  error = '';

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.error = '';
    this.authService.solicitarRecuperacion(this.form.controls.email.value.trim()).subscribe({
      next: respuesta => {
        this.enviado = true;
        this.mensaje = respuesta.message;
        this.enviando = false;
      },
      error: err => {
        this.error = err?.error?.message ?? 'No se pudo enviar el enlace. Inténtalo más tarde.';
        this.enviando = false;
      }
    });
  }
}
