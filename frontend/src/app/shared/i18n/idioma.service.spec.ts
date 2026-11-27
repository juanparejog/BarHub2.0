import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IdiomaService } from './idioma.service';

describe('IdiomaService', () => {
  const crear = () => TestBed.inject(IdiomaService);
  const idiomasDelNavegador = (lista: string[]) =>
    vi.stubGlobal('navigator', { languages: lista, language: lista[0] });

  beforeEach(() => localStorage.removeItem('barhub.idioma'));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem('barhub.idioma');
  });

  it('la primera vez usa el idioma del navegador si es uno de los tres', () => {
    idiomasDelNavegador(['pt-PT', 'en']);
    expect(crear().idioma()).toBe('pt');
  });

  it('con un idioma del navegador que no tenemos, español', () => {
    idiomasDelNavegador(['fr-FR', 'de']);
    expect(crear().idioma()).toBe('es');
  });

  it('lo elegido se recuerda por encima del navegador, y uno guardado que no vale se ignora', () => {
    idiomasDelNavegador(['en-GB']);
    localStorage.setItem('barhub.idioma', 'pt');
    expect(crear().idioma()).toBe('pt');

    TestBed.resetTestingModule();
    localStorage.setItem('barhub.idioma', 'klingon');
    expect(crear().idioma()).toBe('en');
  });

  it('al cambiar, traduce, guarda la elección y pone el lang de la página', () => {
    idiomasDelNavegador(['es-ES']);
    const idiomas = crear();
    expect(document.documentElement.lang).toBe('es');
    expect(idiomas.t('menu.cerrarSesion')).toBe('Cerrar sesión');

    idiomas.cambiar('en');
    expect(idiomas.idioma()).toBe('en');
    expect(idiomas.t('menu.cerrarSesion')).toBe('Log out');
    expect(localStorage.getItem('barhub.idioma')).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    idiomas.cambiar('xx' as never);
    expect(idiomas.idioma()).toBe('en');
  });

  it('los precios en euros con el formato de cada idioma', () => {
    idiomasDelNavegador(['es-ES']);
    const idiomas = crear();
    const sinEspacios = (texto: string) => texto.replaceAll(/\s/g, ' ');
    expect(sinEspacios(idiomas.precio(12.5))).toBe('12,50 €');
    idiomas.cambiar('pt');
    expect(sinEspacios(idiomas.precio('3'))).toBe('3,00 €');
    idiomas.cambiar('en');
    expect(idiomas.precio(1234.5)).toBe('€1,234.50');
    expect(idiomas.precio(null)).toBe('€0.00');
  });

  it('los mensajes de la API (en español) solo se muestran tal cual en español', () => {
    idiomasDelNavegador(['es-ES']);
    const idiomas = crear();
    expect(idiomas.delServidor('Código incorrecto.', 'dosf.incorrecto')).toBe('Código incorrecto.');
    expect(idiomas.delServidor(undefined, 'dosf.incorrecto')).toBe('Código incorrecto.');
    idiomas.cambiar('en');
    expect(idiomas.delServidor('Código incorrecto.', 'dosf.incorrecto')).toBe('Incorrect code.');
    expect(idiomas.fecha(Date.UTC(2026, 0, 15, 12), { month: 'long', year: 'numeric' })).toBe('January 2026');
    idiomas.cambiar('pt');
    expect(idiomas.fecha(Date.UTC(2026, 0, 15, 12), { month: 'long', year: 'numeric' })).toBe('janeiro de 2026');
  });
});
