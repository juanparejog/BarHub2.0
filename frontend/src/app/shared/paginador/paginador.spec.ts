import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PaginadorComponent } from './paginador.component';
import { HUECO, paginaValida, paginar, paginasVisibles, totalPaginas } from './paginar';

describe('paginar', () => {
  const lista = Array.from({ length: 53 }, (_, i) => i + 1);

  it('corta la lista por páginas que empiezan en 1', () => {
    expect(paginar(lista, 1, 25)).toEqual(lista.slice(0, 25));
    expect(paginar(lista, 3, 25)).toEqual([51, 52, 53]);
    expect(totalPaginas(53, 25)).toBe(3);
    expect(totalPaginas(0, 25)).toBe(1);
  });

  it('una página fuera de los límites se queda en la primera o en la última', () => {
    expect(paginaValida(9, 53, 25)).toBe(3);
    expect(paginaValida(0, 53, 25)).toBe(1);
    expect(paginar(lista, 9, 25)).toEqual([51, 52, 53]);
    expect(paginar([], 4, 25)).toEqual([]);
  });

  it('enseña la primera, la última y las vecinas de la actual, con huecos', () => {
    expect(paginasVisibles(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginasVisibles(1, 20)).toEqual([1, 2, 3, 4, 5, HUECO, 20]);
    expect(paginasVisibles(10, 20)).toEqual([1, HUECO, 9, 10, 11, HUECO, 20]);
    expect(paginasVisibles(20, 20)).toEqual([1, HUECO, 16, 17, 18, 19, 20]);
    // Un hueco de una sola página se cambia por su número
    expect(paginasVisibles(4, 20)).toEqual([1, 2, 3, 4, 5, HUECO, 20]);
  });
});

@Component({
  standalone: true,
  imports: [PaginadorComponent],
  template: `<app-paginador [total]="total()" [(pagina)]="pagina" [(tamano)]="tamano" elementos="productos" />`
})
class AnfitrionComponent {
  readonly total = signal(53);
  pagina = 1;
  tamano = 25;
}

describe('PaginadorComponent', () => {
  function crear() {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botones = () => Array.from(raiz.querySelectorAll<HTMLButtonElement>('.paginador-boton'));
    const pulsar = (etiqueta: string) => {
      botones().find(b => b.getAttribute('aria-label') === etiqueta)!.click();
      fixture.detectChanges();
    };
    return { fixture, raiz, botones, pulsar };
  }

  it('dice qué se ve y marca la página actual', () => {
    const { raiz, botones } = crear();
    expect(raiz.querySelector('.paginador-rango')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1–25 de 53 productos');
    expect(botones().find(b => b.classList.contains('activa'))?.getAttribute('aria-current')).toBe('page');
    expect(botones().find(b => b.getAttribute('aria-label') === 'Página anterior')?.disabled).toBe(true);
  });

  it('cambia de página en los dos sentidos y desactiva «siguiente» en la última', () => {
    const { fixture, raiz, botones, pulsar } = crear();
    pulsar('Página 3');
    expect(fixture.componentInstance.pagina).toBe(3);
    expect(raiz.querySelector('.paginador-rango')?.textContent).toContain('51–53 de 53');
    expect(botones().find(b => b.getAttribute('aria-label') === 'Página siguiente')?.disabled).toBe(true);

    pulsar('Página anterior');
    expect(fixture.componentInstance.pagina).toBe(2);
  });

  it('al cambiar el tamaño vuelve a la primera página', () => {
    const { fixture, raiz, pulsar } = crear();
    pulsar('Página 2');
    const selector = raiz.querySelector('select')!;
    selector.value = '10';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.tamano).toBe(10);
    expect(fixture.componentInstance.pagina).toBe(1);
    expect(raiz.querySelectorAll('.paginador-boton:not(.paginador-flecha)')).toHaveLength(6);
  });

  it('sin elementos no se pinta, y con una sola página no hay botones', () => {
    const { fixture, raiz } = crear();
    fixture.componentInstance.total.set(0);
    fixture.detectChanges();
    expect(raiz.querySelector('nav')).toBeNull();

    fixture.componentInstance.total.set(7);
    fixture.detectChanges();
    expect(raiz.querySelector('.paginador-rango')?.textContent).toContain('1–7 de 7');
    expect(raiz.querySelector('.paginador-paginas')).toBeNull();
  });
});
