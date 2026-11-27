import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

/** "He olvidado mi contrasena": pide el correo y envia el enlace para elegir una nueva. */
@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TraducirPipe],
  templateUrl: './recuperar.component.html',
  styleUrls: ['./cuenta-correo.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class RecuperarComponent {
  private readonly idiomas = inject(IdiomaService);
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
        this.mensaje = this.idiomas.delServidor(respuesta.message, 'recuperar.enviado');
        this.enviando = false;
      },
      error: err => {
        this.error = this.idiomas.delServidor(err?.error?.message, 'recuperar.error');
        this.enviando = false;
      }
    });
  }
}
