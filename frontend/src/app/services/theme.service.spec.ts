import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ThemeService } from './theme.service';

/** jsdom no implementa matchMedia: se simula la preferencia de color del sistema. */
function simularPreferenciaOscura(oscuro: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((consulta: string) => ({
      matches: oscuro && consulta.includes('dark'),
      media: consulta,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
}

describe('ThemeService', () => {
  const temaDeBootstrap = () => document.documentElement.getAttribute('data-bs-theme');
  const bodyOscuro = () => document.body.classList.contains('dark-theme');
  const crearServicio = () => TestBed.inject(ThemeService);

  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('dark-theme');
    document.documentElement.removeAttribute('data-bs-theme');
    simularPreferenciaOscura(false);
    TestBed.configureTestingModule({});
  });

  it('usa el tema guardado aunque el sistema prefiera otro', () => {
    localStorage.setItem('theme', 'dark');
    crearServicio();
    expect(temaDeBootstrap()).toBe('dark');
    expect(bodyOscuro()).toBe(true);
  });

  it('sin tema guardado empieza en claro aunque el sistema prefiera el oscuro', () => {
    simularPreferenciaOscura(true);
    crearServicio();
    expect(temaDeBootstrap()).toBe('light');
    expect(bodyOscuro()).toBe(false);
  });

  it('toggleTheme alterna el atributo de Bootstrap, la clase del body y lo guardado', () => {
    const servicio = crearServicio();
    expect(temaDeBootstrap()).toBe('light');

    servicio.toggleTheme();
    expect(temaDeBootstrap()).toBe('dark');
    expect(bodyOscuro()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    servicio.toggleTheme();
    expect(temaDeBootstrap()).toBe('light');
    expect(bodyOscuro()).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('isDarkMode$ emite el estado actual y cada cambio', () => {
    const servicio = crearServicio();
    const emitidos: boolean[] = [];
    servicio.isDarkMode$.subscribe(valor => emitidos.push(valor));
    servicio.setDarkMode(true);
    servicio.setDarkMode(false);
    expect(emitidos).toEqual([false, true, false]);
  });
});
