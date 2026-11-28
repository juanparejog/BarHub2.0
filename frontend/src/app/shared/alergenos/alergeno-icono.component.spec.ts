import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AlergenoIconoComponent } from './alergeno-icono.component';
import { ALERGENOS } from './alergenos';
import { IdiomaService } from '../i18n/idioma.service';

@Component({
  standalone: true,
  imports: [AlergenoIconoComponent],
  template: `
    @for (alergeno of codigos(); track alergeno) {
      <app-alergeno-icono [codigo]="alergeno" [tamano]="tamano()" [decorativo]="decorativo()" />
    }
  `
})
class AnfitrionComponent {
  readonly codigos = signal<string[]>(ALERGENOS.map(a => a.codigo));
  readonly tamano = signal(28);
  readonly decorativo = signal(false);
}

describe('AlergenoIconoComponent', () => {
  function crear() {
    localStorage.setItem('barhub.idioma', 'es');
    TestBed.configureTestingModule({ imports: [AnfitrionComponent] });
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('cada uno de los 14 se dibuja con su nombre como texto alternativo y su propio color', () => {
    const { raiz } = crear();
    const iconos = Array.from(raiz.querySelectorAll('svg'));
    expect(iconos).toHaveLength(14);
    expect(iconos.map(svg => svg.getAttribute('aria-label'))).toEqual(ALERGENOS.map(a => a.nombre));
    expect(iconos.every(svg => svg.getAttribute('role') === 'img')).toBe(true);
    expect(iconos[0].querySelector('title')?.textContent).toBe('Gluten');
    // Un pictograma por alérgeno, no el de reserva
    expect(iconos.every(svg => svg.querySelector('g')!.children.length > 0)).toBe(true);
    expect(iconos.some(svg => svg.textContent?.includes('?'))).toBe(false);
    const colores = iconos.map(svg => svg.querySelector('circle')!.getAttribute('fill'));
    expect(new Set(colores).size).toBe(14);
  });

  it('el nombre cambia con el idioma elegido en el menú', () => {
    const { fixture, raiz } = crear();
    fixture.componentInstance.codigos.set(['LACTEOS']);
    fixture.detectChanges();
    expect(raiz.querySelector('svg')!.getAttribute('aria-label')).toBe('Lácteos');

    TestBed.inject(IdiomaService).cambiar('en');
    fixture.detectChanges();
    expect(raiz.querySelector('svg')!.getAttribute('aria-label')).toBe('Milk');
    expect(raiz.querySelector('title')?.textContent).toBe('Milk');
    localStorage.removeItem('barhub.idioma');
  });

  it('decorativo se oculta a los lectores de pantalla; el tamaño se aplica', () => {
    const { fixture, raiz } = crear();
    fixture.componentInstance.decorativo.set(true);
    fixture.componentInstance.tamano.set(40);
    fixture.componentInstance.codigos.set(['SOJA']);
    fixture.detectChanges();

    const svg = raiz.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.querySelector('title')).toBeNull();
    expect(svg.getAttribute('width')).toBe('40');
  });

  it('un código desconocido muestra un interrogante en gris en lugar de romperse', () => {
    const { fixture, raiz } = crear();
    fixture.componentInstance.codigos.set(['CHOCOLATE']);
    fixture.detectChanges();

    const svg = raiz.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('CHOCOLATE');
    expect(svg.textContent).toContain('?');
  });
});
