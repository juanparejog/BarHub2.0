import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild
} from '@angular/core';
import { ReautenticacionService } from '../../auth/reautenticacion.service';

/** Ventana que pide el codigo de la app (o la contrasena) antes de una accion critica. */
@Component({
  selector: 'app-reautenticacion',
  standalone: true,
  templateUrl: './reautenticacion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReautenticacionComponent {
  readonly reautenticacion = inject(ReautenticacionService);
  readonly conCodigo = computed(() => this.reautenticacion.solicitud() === 'codigo');
  readonly error = signal('');
  readonly enviando = signal(false);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  constructor() {
    // Al abrirse, el foco va al campo y no queda nada de la vez anterior
    effect(() => {
      const elemento = this.campo()?.nativeElement;
      if (elemento) {
        elemento.value = '';
        elemento.focus();
      }
    });
  }

  confirmar(): void {
    const limpio = (this.campo()?.nativeElement.value ?? '').trim();
    if (!limpio || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    this.reautenticacion.confirmar(limpio).subscribe({
      next: () => this.enviando.set(false),
      error: err => {
        this.enviando.set(false);
        const campo = this.campo()?.nativeElement;
        if (campo) {
          campo.value = '';
          campo.focus();
        }
        this.error.set(err?.status === 400 || err?.status === 429
          ? err.error?.message ?? 'No se ha podido confirmar.'
          : 'No se ha podido confirmar. Inténtalo de nuevo.');
      }
    });
  }

  cancelar(): void {
    this.error.set('');
    this.reautenticacion.cancelar();
  }
}
