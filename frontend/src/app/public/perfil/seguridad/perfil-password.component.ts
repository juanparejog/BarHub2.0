import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { PerfilService } from '../perfil.service';

function coinciden(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nueva')?.value;
  const repetida = grupo.get('repetida')?.value;
  return nueva && repetida && nueva !== repetida ? { noCoinciden: true } : null;
}

/** Cambio de contraseña: pide la actual y cierra las demás sesiones abiertas. */
@Component({
  selector: 'app-perfil-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './perfil-password.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilPasswordComponent {
  private readonly perfil = inject(PerfilService);

  readonly form = new FormGroup({
    actual: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nueva: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6), Validators.maxLength(40)] }),
    repetida: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: coinciden });
  readonly enviando = signal(false);
  readonly exito = signal('');
  readonly error = signal('');

  invalido(campo: 'actual' | 'nueva' | 'repetida'): boolean {
    const control = this.form.controls[campo];
    const noCoinciden = campo === 'repetida' && this.form.hasError('noCoinciden');
    return (control.invalid || noCoinciden) && control.touched;
  }

  cambiar(): void {
    this.exito.set('');
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { actual, nueva } = this.form.getRawValue();
    this.enviando.set(true);
    this.perfil.cambiarPassword(actual, nueva).subscribe({
      next: cerradas => {
        this.enviando.set(false);
        this.form.reset();
        this.exito.set('Contraseña cambiada.' + (cerradas === 1
          ? ' Hemos cerrado la otra sesión que tenías abierta.'
          : cerradas > 1 ? ` Hemos cerrado las otras ${cerradas} sesiones que tenías abiertas.` : ''));
      },
      error: err => {
        this.enviando.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo cambiar la contraseña.');
      }
    });
  }
}
