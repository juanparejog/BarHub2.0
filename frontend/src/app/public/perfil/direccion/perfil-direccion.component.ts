import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { PerfilService } from '../perfil.service';
import { IdiomaService } from '../../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../../shared/i18n/traducir.pipe';

type TipoVivienda = 'piso' | 'urbanizacion' | 'casa';

/** Campos que dependen del tipo de inmueble y son obligatorios para él. */
const OBLIGATORIOS_POR_TIPO: Record<TipoVivienda, string[]> = {
  piso: ['portalNum', 'pisoNum', 'puerta'],
  urbanizacion: ['urbanizacionNombre', 'casaNum'],
  casa: ['casaNum']
};

/** Pestaña «Dirección de entrega»: la dirección y el teléfono que se proponen en los pedidos a domicilio. */
@Component({
  selector: 'app-perfil-direccion',
  standalone: true,
  imports: [ReactiveFormsModule, TraducirPipe],
  templateUrl: './perfil-direccion.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilDireccionComponent {
  private readonly idiomas = inject(IdiomaService);
  readonly perfil = inject(PerfilService);

  readonly form = new FormGroup({
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{9}$/)] }),
    codigoPostal: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{5}$/)] }),
    calle: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(150)] }),
    tipoVivienda: new FormControl<TipoVivienda>('piso', { nonNullable: true }),
    portalNum: new FormControl('', { nonNullable: true }),
    pisoNum: new FormControl('', { nonNullable: true }),
    puerta: new FormControl('', { nonNullable: true }),
    urbanizacionNombre: new FormControl('', { nonNullable: true }),
    casaNum: new FormControl('', { nonNullable: true }),
    instruccionesEntrega: new FormControl('', { nonNullable: true })
  });
  readonly tipo = signal<TipoVivienda>('piso');
  readonly guardando = signal(false);
  readonly exito = signal('');
  readonly error = signal('');

  constructor() {
    this.form.controls.tipoVivienda.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(tipo => this.aplicarTipo(tipo));
    this.aplicarTipo('piso');

    effect(() => {
      const u = this.perfil.usuario();
      if (u && this.form.pristine) {
        const tipo = (u.tipoVivienda?.toLowerCase() as TipoVivienda | undefined) ?? 'piso';
        this.form.reset({
          telefono: u.telefono ?? '',
          codigoPostal: u.codigoPostal ?? '',
          calle: u.calle ?? '',
          tipoVivienda: OBLIGATORIOS_POR_TIPO[tipo] ? tipo : 'piso',
          portalNum: u.portalNum ?? '',
          pisoNum: u.pisoNum ?? '',
          puerta: u.puerta ?? '',
          urbanizacionNombre: u.urbanizacionNombre ?? '',
          casaNum: u.casaNum ?? '',
          instruccionesEntrega: u.instruccionesEntrega ?? ''
        });
      }
    });
  }

  invalido(campo: keyof PerfilDireccionComponent['form']['controls']): boolean {
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
    const valores = this.form.getRawValue();
    // Solo se guardan los campos del tipo de inmueble elegido
    const usados = OBLIGATORIOS_POR_TIPO[valores.tipoVivienda];
    const segunTipo = (campo: string, valor: string) => usados.includes(campo) ? valor.trim() : '';
    this.guardando.set(true);
    this.perfil.guardar({
      telefono: valores.telefono.trim(),
      codigoPostal: valores.codigoPostal.trim(),
      calle: valores.calle.trim(),
      tipoVivienda: valores.tipoVivienda,
      portalNum: segunTipo('portalNum', valores.portalNum),
      pisoNum: segunTipo('pisoNum', valores.pisoNum),
      puerta: segunTipo('puerta', valores.puerta),
      urbanizacionNombre: segunTipo('urbanizacionNombre', valores.urbanizacionNombre),
      casaNum: segunTipo('casaNum', valores.casaNum),
      instruccionesEntrega: valores.instruccionesEntrega.trim()
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.markAsPristine();
        this.exito.set(this.idiomas.t('perfil.dir.guardada'));
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(this.idiomas.delServidor(err?.error?.message, 'perfil.dir.error'));
      }
    });
  }

  private aplicarTipo(tipo: TipoVivienda): void {
    this.tipo.set(tipo);
    const obligatorios = OBLIGATORIOS_POR_TIPO[tipo] ?? [];
    for (const campo of ['portalNum', 'pisoNum', 'puerta', 'urbanizacionNombre', 'casaNum'] as const) {
      const control = this.form.controls[campo];
      const validadores: ValidatorFn[] = obligatorios.includes(campo) ? [Validators.required, Validators.maxLength(100)] : [];
      control.setValidators(validadores);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }
}
