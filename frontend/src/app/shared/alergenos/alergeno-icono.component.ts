import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { nombreAlergeno } from './alergenos';

/**
 * Color de fondo de cada alérgeno. Todos con contraste de al menos 3:1 frente al pictograma blanco
 * (WCAG 1.4.11), también en modo oscuro.
 */
const COLORES: Readonly<Record<string, string>> = {
  GLUTEN: '#b45309',
  CRUSTACEOS: '#b91c1c',
  HUEVOS: '#a16207',
  PESCADO: '#1d4ed8',
  CACAHUETES: '#92400e',
  SOJA: '#15803d',
  LACTEOS: '#0369a1',
  FRUTOS_DE_CASCARA: '#9f1239',
  APIO: '#4d7c0f',
  MOSTAZA: '#854d0e',
  SESAMO: '#57534e',
  SULFITOS: '#6b21a8',
  ALTRAMUCES: '#c2410c',
  MOLUSCOS: '#0f766e'
};

/**
 * Icono de un alérgeno: círculo de color con un pictograma blanco, dibujado en SVG (sin imágenes
 * ni servicios de fuera, compatible con la CSP). Lleva el nombre como texto alternativo, que es lo
 * que lee un lector de pantalla y lo que sale al pasar el ratón. Con {@code decorativo} se oculta a
 * los lectores de pantalla, para cuando el nombre ya está escrito al lado.
 */
@Component({
  selector: 'app-alergeno-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: inline-flex; line-height: 0; } svg { display: block; }'],
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" [attr.width]="tamano()" [attr.height]="tamano()"
      [attr.role]="decorativo() ? null : 'img'" [attr.aria-label]="decorativo() ? null : nombre()"
      [attr.aria-hidden]="decorativo() ? 'true' : null" focusable="false">
      @if (!decorativo()) {
        <title>{{ nombre() }}</title>
      }
      <circle cx="24" cy="24" r="24" [attr.fill]="color()" />
      <g fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
        @switch (codigo()) {
          @case ('GLUTEN') {
            <path d="M24 41V13" fill="none" stroke-width="2.4" />
            <ellipse cx="24" cy="10.5" rx="2.4" ry="4.2" stroke="none" />
            <ellipse cx="20.2" cy="16" rx="2.4" ry="4.4" transform="rotate(-38 20.2 16)" stroke="none" />
            <ellipse cx="27.8" cy="16" rx="2.4" ry="4.4" transform="rotate(38 27.8 16)" stroke="none" />
            <ellipse cx="20.2" cy="22.5" rx="2.4" ry="4.4" transform="rotate(-38 20.2 22.5)" stroke="none" />
            <ellipse cx="27.8" cy="22.5" rx="2.4" ry="4.4" transform="rotate(38 27.8 22.5)" stroke="none" />
            <ellipse cx="20.2" cy="29" rx="2.4" ry="4.4" transform="rotate(-38 20.2 29)" stroke="none" />
            <ellipse cx="27.8" cy="29" rx="2.4" ry="4.4" transform="rotate(38 27.8 29)" stroke="none" />
          }
          @case ('CRUSTACEOS') {
            <ellipse cx="24" cy="29" rx="9" ry="6.5" stroke="none" />
            <path d="M18 25 13 19M30 25l5-6M15.5 30.5H10M15.5 33.5 11 37M32.5 30.5H38M32.5 33.5 37 37M21 23v-4M27 23v-4"
              fill="none" stroke-width="2" />
            <path d="M13 19c-4-1-5-6-2-8 1 2 3 3 5 3-1 2-1 4-3 5Z" stroke="none" />
            <path d="M35 19c4-1 5-6 2-8-1 2-3 3-5 3 1 2 1 4 3 5Z" stroke="none" />
          }
          @case ('HUEVOS') {
            <path d="M24 10c6.5 0 10.5 11 10.5 17.5S29.8 39 24 39s-10.5-5-10.5-11.5S17.5 10 24 10Z" stroke="none" />
          }
          @case ('PESCADO') {
            <path d="M8.5 24c4-6.5 10-9 16-9s10 3.5 12 6.5l6-5v15l-6-5c-2 3-6 6.5-12 6.5s-12-2.5-16-9Z" stroke="none" />
            <circle cx="15.5" cy="22" r="1.8" [attr.fill]="color()" stroke="none" />
          }
          @case ('CACAHUETES') {
            <path d="M24 9.5c4.5 0 7.5 3 7.5 7 0 2.6-1.4 4.2-1.4 7.5s1.4 4.9 1.4 7.5c0 4-3 7-7.5 7s-7.5-3-7.5-7c0-2.6 1.4-4.2 1.4-7.5S16.5 19.1 16.5 16.5c0-4 3-7 7.5-7Z"
              stroke="none" />
            <circle cx="21.5" cy="15.5" r="1" [attr.fill]="color()" stroke="none" />
            <circle cx="26.5" cy="18" r="1" [attr.fill]="color()" stroke="none" />
            <circle cx="22" cy="30" r="1" [attr.fill]="color()" stroke="none" />
            <circle cx="26.5" cy="33" r="1" [attr.fill]="color()" stroke="none" />
          }
          @case ('SOJA') {
            <rect x="9" y="19" width="30" height="10" rx="5" transform="rotate(-35 24 24)" fill="none" stroke-width="2.2" />
            <circle cx="17.5" cy="28.6" r="3" stroke="none" />
            <circle cx="24" cy="24" r="3" stroke="none" />
            <circle cx="30.5" cy="19.4" r="3" stroke="none" />
          }
          @case ('LACTEOS') {
            <path d="M20 9h8v5.5l4.5 6V37a2.5 2.5 0 0 1-2.5 2.5H18A2.5 2.5 0 0 1 15.5 37V20.5l4.5-6Z" stroke="none" />
            <rect x="15.5" y="25" width="17" height="6" [attr.fill]="color()" stroke="none" />
          }
          @case ('FRUTOS_DE_CASCARA') {
            <path d="M24 9.5c7 4.5 9.5 11.5 9.5 16.5 0 7-4.3 12.5-9.5 12.5S14.5 33 14.5 26c0-5 2.5-12 9.5-16.5Z" stroke="none" />
            <path d="M24 14c-2 5-2 14 0 21" fill="none" [attr.stroke]="color()" stroke-width="1.6" />
          }
          @case ('APIO') {
            <path d="M24 40V21M19 40l-1.5-17M29 40l1.5-17" fill="none" stroke-width="2.6" />
            <circle cx="24" cy="15" r="4" stroke="none" />
            <circle cx="17" cy="18" r="3.4" stroke="none" />
            <circle cx="31" cy="18" r="3.4" stroke="none" />
            <circle cx="20.5" cy="11.5" r="3" stroke="none" />
            <circle cx="27.5" cy="11.5" r="3" stroke="none" />
          }
          @case ('MOSTAZA') {
            <rect x="22.6" y="7.5" width="2.8" height="6" rx="1" stroke="none" />
            <path d="M19.5 13.5h9l2 4V37a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 17.5 37V17.5Z" stroke="none" />
            <path d="M21 26h6" fill="none" [attr.stroke]="color()" stroke-width="1.8" />
          }
          @case ('SESAMO') {
            <ellipse cx="17" cy="20" rx="3" ry="5.2" transform="rotate(-25 17 20)" stroke="none" />
            <ellipse cx="29" cy="17" rx="3" ry="5.2" transform="rotate(20 29 17)" stroke="none" />
            <ellipse cx="23" cy="31" rx="3" ry="5.2" transform="rotate(70 23 31)" stroke="none" />
            <ellipse cx="32.5" cy="30" rx="3" ry="5.2" transform="rotate(-10 32.5 30)" stroke="none" />
          }
          @case ('SULFITOS') {
            <text x="24" y="28.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14"
              font-weight="700" stroke="none">SO<tspan font-size="9" dy="3">2</tspan></text>
          }
          @case ('ALTRAMUCES') {
            <circle cx="17.5" cy="19" r="6" stroke="none" />
            <circle cx="30.5" cy="19" r="6" stroke="none" />
            <circle cx="24" cy="31" r="6" stroke="none" />
            <path d="M17.5 16.5v2M30.5 16.5v2M24 28.5v2" fill="none" [attr.stroke]="color()" stroke-width="1.6" />
          }
          @case ('MOLUSCOS') {
            <path d="M11 24a13 13 0 0 1 26 0l-10 12h-6Z" stroke="none" />
            <path d="M24 35V12.5M24 35l-8-20M24 35l8-20M24 35 12.5 21M24 35l11.5-14" fill="none"
              [attr.stroke]="color()" stroke-width="1.4" />
            <rect x="20" y="35.5" width="8" height="3" rx="1" stroke="none" />
          }
          @default {
            <text x="24" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16"
              font-weight="700" stroke="none">?</text>
          }
        }
      </g>
    </svg>
  `
})
export class AlergenoIconoComponent {
  readonly codigo = input.required<string>();
  /** Diámetro en píxeles. */
  readonly tamano = input(28);
  /** Oculto a los lectores de pantalla (cuando el nombre ya está escrito al lado). */
  readonly decorativo = input(false);

  readonly nombre = computed(() => nombreAlergeno(this.codigo()));
  readonly color = computed(() => COLORES[this.codigo()] ?? '#475569');
}
