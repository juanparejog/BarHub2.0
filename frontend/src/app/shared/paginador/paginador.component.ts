import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TraducirPipe } from '../i18n/traducir.pipe';
import { HUECO, paginaValida, paginasVisibles, totalPaginas } from './paginar';

/**
 * Paginación de un listado: «1–25 de 340», botones de página y elementos por página.
 * La página empieza en 1 y se enlaza en los dos sentidos: {@code [(pagina)]="pagina"}.
 * Vale para listas que se paginan en el navegador (con {@link paginar}) y para las que pagina
 * el servidor (escuchando {@code (paginaChange)}).
 */
@Component({
  selector: 'app-paginador',
  standalone: true,
  imports: [TraducirPipe],
  templateUrl: './paginador.component.html',
  styleUrls: ['./paginador.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginadorComponent {
  /** Elementos en total (no los de la página). */
  readonly total = input.required<number>();
  readonly pagina = model(1);
  readonly tamano = model(25);
  readonly tamanos = input<readonly number[]>([10, 25, 50, 100]);
  /** Sin selector de tamaño cuando lo fija el servidor. */
  readonly conTamano = input(true);
  /** Nombre de lo que se lista, tras el rango: «1–25 de 340 productos». */
  readonly elementos = input('');
  /** Elemento al que se sube al cambiar de página (el principio del listado). */
  readonly ancla = input<HTMLElement | null | undefined>(null);

  readonly hueco = HUECO;
  readonly ultima = computed(() => totalPaginas(this.total(), this.tamano()));
  readonly actual = computed(() => paginaValida(this.pagina(), this.total(), this.tamano()));
  readonly desde = computed(() => (this.actual() - 1) * this.tamano() + 1);
  readonly hasta = computed(() => Math.min(this.actual() * this.tamano(), this.total()));
  readonly visibles = computed(() => paginasVisibles(this.actual(), this.ultima()));

  /** Acepta lo que pinta la lista de páginas; el hueco («…») no lleva a ninguna. */
  ir(pagina: number | typeof HUECO): void {
    if (pagina === HUECO) {
      return;
    }
    const destino = paginaValida(pagina, this.total(), this.tamano());
    if (destino === this.actual()) {
      return;
    }
    this.pagina.set(destino);
    this.subir();
  }

  cambiarTamano(evento: Event): void {
    const tamano = Number((evento.target as HTMLSelectElement).value);
    if (!Number.isFinite(tamano) || tamano <= 0 || tamano === this.tamano()) {
      return;
    }
    this.tamano.set(tamano);
    this.pagina.set(1);
  }

  private subir(): void {
    const ancla = this.ancla();
    if (ancla && typeof ancla.scrollIntoView === 'function') {
      const reducir = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      ancla.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
    }
  }
}
