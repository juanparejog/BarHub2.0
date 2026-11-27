import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IDIOMAS, type Idioma } from './idiomas';
import { IdiomaService } from './idioma.service';
import { TraducirPipe } from './traducir.pipe';

/**
 * Selector de idioma del menú: una pastilla con tres botones redondos con la bandera de cada idioma
 * (España, Portugal y Reino Unido), como el interruptor del modo oscuro. Las banderas están dibujadas
 * en SVG (sin imágenes ni servicios de fuera, compatible con la CSP). Cada botón lleva el nombre del
 * idioma en ese idioma y su lang, que es lo que lee un lector de pantalla; el activo va marcado con
 * aria-pressed.
 */
@Component({
  selector: 'app-selector-idioma',
  standalone: true,
  imports: [TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; }
    .idioma-switch {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border-radius: 30px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: background 0.3s ease, border-color 0.3s ease;
    }
    .idioma-switch:hover {
      border-color: rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.4);
    }
    .idioma-opcion {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bandera {
      display: block;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      overflow: hidden;
      opacity: 0.55;
      filter: saturate(0.6);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
      transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
    }
    .bandera svg { display: block; width: 100%; height: 100%; }
    .idioma-opcion:hover .bandera,
    .idioma-opcion:focus-visible .bandera {
      opacity: 1;
      filter: none;
      transform: scale(1.08);
    }
    .idioma-opcion:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 1px;
    }
    .idioma-opcion.activa {
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }
    .idioma-opcion.activa .bandera {
      opacity: 1;
      filter: none;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
    }
    :host-context(.dark-theme) .idioma-opcion.activa { background: #1d4ed8; }
    @media (prefers-reduced-motion: reduce) {
      .idioma-opcion, .bandera { transition: none; }
      .idioma-opcion:hover .bandera { transform: none; }
    }
  `],
  template: `
    <div class="idioma-switch" role="group" [attr.aria-label]="'menu.idioma' | t">
      @for (idioma of opciones; track idioma.codigo) {
        <button type="button" class="idioma-opcion" [class.activa]="idioma.codigo === idiomas.idioma()"
          [attr.aria-pressed]="idioma.codigo === idiomas.idioma()" [attr.aria-label]="idioma.nombre"
          [attr.lang]="idioma.codigo" [title]="idioma.nombre" (click)="idiomas.cambiar(idioma.codigo)">
          <span class="bandera" aria-hidden="true">
            @switch (idioma.codigo) {
              @case ('es') {
                <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice" focusable="false">
                  <rect width="32" height="32" fill="#AA151B" />
                  <rect y="8" width="32" height="16" fill="#F1BF00" />
                </svg>
              }
              @case ('pt') {
                <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice" focusable="false">
                  <rect width="32" height="32" fill="#DA291C" />
                  <rect width="13" height="32" fill="#046A38" />
                  <circle cx="13" cy="16" r="6" fill="none" stroke="#FFE900" stroke-width="2" />
                  <path d="M10.5 13h5v4.2a2.5 2.5 0 0 1-5 0Z" fill="#FFFFFF" stroke="#DA291C" stroke-width="1" />
                </svg>
              }
              @default {
                <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid slice" focusable="false">
                  <rect width="32" height="32" fill="#012169" />
                  <path d="M0 0 32 32M32 0 0 32" stroke="#FFFFFF" stroke-width="7" />
                  <path d="M0 0 32 32M32 0 0 32" stroke="#C8102E" stroke-width="2.5" />
                  <path d="M16 0v32M0 16h32" stroke="#FFFFFF" stroke-width="10" />
                  <path d="M16 0v32M0 16h32" stroke="#C8102E" stroke-width="6" />
                </svg>
              }
            }
          </span>
        </button>
      }
    </div>
  `
})
export class SelectorIdiomaComponent {
  readonly idiomas = inject(IdiomaService);
  readonly opciones: ReadonlyArray<{ codigo: Idioma; nombre: string }> = IDIOMAS;
}
