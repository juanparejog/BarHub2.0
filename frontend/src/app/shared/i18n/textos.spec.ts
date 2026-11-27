import { EN } from './textos.en';
import { ES } from './textos.es';
import { PT } from './textos.pt';
import { traducir, traducirSiExiste } from './textos';

const datosDe = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('Textos de las pantallas del cliente', () => {
  it('portugués e inglés tienen exactamente las mismas claves que el español, ninguna vacía', () => {
    const claves = Object.keys(ES).sort();
    expect(Object.keys(PT).sort()).toEqual(claves);
    expect(Object.keys(EN).sort()).toEqual(claves);
    for (const textos of [ES, PT, EN]) {
      expect(Object.values(textos).every(texto => texto.trim().length > 0)).toBe(true);
    }
  });

  it('cada traducción lleva los mismos datos entre llaves que el original', () => {
    for (const clave of Object.keys(ES) as (keyof typeof ES)[]) {
      expect(datosDe(PT[clave]), `pt: ${clave}`).toEqual(datosDe(ES[clave]));
      expect(datosDe(EN[clave]), `en: ${clave}`).toEqual(datosDe(ES[clave]));
    }
  });

  it('pone los datos, deja como están los que no se pasan y no interpreta HTML', () => {
    expect(traducir('es', 'carta.mesa.opcion', { id: 3, estado: 'libre' })).toBe('Mesa #3 (libre)');
    expect(traducir('pt', 'carta.mesa.opcion', { id: 3, estado: 'livre' })).toBe('Mesa n.º 3 (livre)');
    expect(traducir('en', 'carta.mesa.opcion', { id: 3 })).toBe('Table #3 ({estado})');
    expect(traducir('en', 'seguimiento.pedido', { id: '<b>7</b>' })).toBe('Order #<b>7</b>');
    expect(traducir('pt', 'menu.carta')).toBe('Ementa');
  });

  it('las claves que dependen de la API tienen un texto de reserva', () => {
    expect(traducirSiExiste('en', 'estado.LISTO_PARA_RECOGER', 'x')).toBe('ready to collect');
    expect(traducirSiExiste('en', 'estado.INVENTADO', 'inventado')).toBe('inventado');
  });
});
