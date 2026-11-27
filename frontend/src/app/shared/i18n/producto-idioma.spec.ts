import { descripcionDe, nombreDe } from './producto-idioma';

describe('Nombre y descripción de los productos según el idioma', () => {
  const tortilla = {
    nombre: 'Tortilla', descripcion: 'Tortilla de patatas',
    nombrePt: 'Tortilha de batata', nombreEn: 'Spanish omelette', descripcionPt: null, descripcionEn: '  '
  };

  it('usa la traducción del idioma y, si falta o está en blanco, el español', () => {
    expect(nombreDe(tortilla, 'es')).toBe('Tortilla');
    expect(nombreDe(tortilla, 'pt')).toBe('Tortilha de batata');
    expect(nombreDe(tortilla, 'en')).toBe('Spanish omelette');
    expect(descripcionDe(tortilla, 'pt')).toBe('Tortilla de patatas');
    expect(descripcionDe(tortilla, 'en')).toBe('Tortilla de patatas');
  });

  it('un producto sin traducciones ni descripción', () => {
    expect(nombreDe({ nombre: 'Agua' }, 'en')).toBe('Agua');
    expect(descripcionDe({ nombre: 'Agua' }, 'en')).toBe('');
  });
});
