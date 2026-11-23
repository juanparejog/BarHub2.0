import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PerfilService } from '../perfil.service';

/** Pestaña «Datos personales»: nombre y apellidos. Usuario y correo se muestran, no se editan aquí. */
@Component({
  selector: 'app-perfil-datos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './perfil-datos.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilDatosComponent {
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
      this.error.set('Revisa los campos marcados.');
      return;
    }
    this.guardando.set(true);
    const { nombre, apellido1, apellido2 } = this.form.getRawValue();
    this.perfil.guardar({ nombre: nombre.trim(), apellido1: apellido1.trim(), apellido2: apellido2.trim() }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.markAsPristine();
        this.exito.set('Datos guardados.');
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(err?.error?.message ?? 'No se pudieron guardar los datos.');
      }
    });
  }
}
