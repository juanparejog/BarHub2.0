import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AvisoService } from './aviso.service';
import { TraducirPipe } from '../i18n/traducir.pipe';

/**
 * Pinta los avisos de {@link AvisoService}: el dialogo (con el foco atrapado en sus botones y el
 * fondo sin desplazarse) y los avisos flotantes. Va una sola vez, en AppComponent.
 */
@Component({
  selector: 'app-avisos',
  standalone: true,
  imports: [TraducirPipe],
  templateUrl: './avisos.component.html',
  styleUrls: ['./avisos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvisosComponent {
  readonly avisos = inject(AvisoService);
  private readonly caja = viewChild<ElementRef<HTMLElement>>('caja');
  private focoAnterior: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const abierto = this.avisos.dialogo() !== null;
      document.body.classList.toggle('con-dialogo', abierto);
      const caja = this.caja()?.nativeElement;
      if (abierto && caja) {
        this.focoAnterior ??= document.activeElement as HTMLElement | null;
        (caja.querySelector<HTMLElement>('.aviso-boton.primaria') ?? caja.querySelector<HTMLElement>('button'))?.focus();
      } else if (!abierto && this.focoAnterior) {
        this.focoAnterior.focus?.();
        this.focoAnterior = null;
      }
    });
  }

  /** Clic en el fondo, fuera de la caja del dialogo. */
  alPulsarFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.avisos.cerrar();
    }
  }

  /** Escape cierra; Tab no sale del dialogo. */
  alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.avisos.cerrar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const botones = Array.from(this.caja()?.nativeElement.querySelectorAll<HTMLElement>('button') ?? []);
    if (botones.length === 0) return;
    const primero = botones[0];
    const ultimo = botones.at(-1)!;
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
