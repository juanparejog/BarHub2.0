import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerfilService } from '../perfil.service';
import { IdiomaService } from '../../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../../shared/i18n/traducir.pipe';

/** Pestaña «Datos personales»: nombre y apellidos. Usuario y correo se muestran; el correo se cambia en «Cuenta y correo». */
@Component({
  selector: 'app-perfil-datos',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TraducirPipe],
  templateUrl: './perfil-datos.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilDatosComponent {
  private readonly idiomas = inject(IdiomaService);
  readonly perfil = inject(PerfilService);

  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    apellido1: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    apellido2: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] })
  });
  readonly guardando = signal(false);
  readonly exito = signal('');
  readonly error = signal('');

  constructor() {
    // Rellena el formulario al cargar el perfil, sin pisar lo que el usuario esté escribiendo
    effect(() => {
      const usuario = this.perfil.usuario();
      if (usuario && this.form.pristine) {
        this.form.reset({
          nombre: usuario.nombre ?? '',
          apellido1: usuario.apellido1 ?? '',
          apellido2: usuario.apellido2 ?? ''
        });
      }
    });
  }

  invalido(campo: 'nombre' | 'apellido1' | 'apellido2'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  guardar(): void {
    this.exito.set('');
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.idiomas.t('perfil.revisa'));
      return;
    }
    this.guardando.set(true);
    const { nombre, apellido1, apellido2 } = this.form.getRawValue();
    this.perfil.guardar({ nombre: nombre.trim(), apellido1: apellido1.trim(), apellido2: apellido2.trim() }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.markAsPristine();
        this.exito.set(this.idiomas.t('perfil.datos.guardados'));
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(this.idiomas.delServidor(err?.error?.message, 'perfil.datos.error'));
      }
    });
  }
}
