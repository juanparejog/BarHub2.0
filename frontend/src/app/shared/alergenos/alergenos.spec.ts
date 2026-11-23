import { ALERGENOS, aptoSin, nombreAlergeno, textoAlergenos } from './alergenos';

describe('alérgenos', () => {
  it('son los 14 del reglamento, sin repetir', () => {
    expect(ALERGENOS.length).toBe(14);
    expect(new Set(ALERGENOS.map(a => a.codigo)).size).toBe(14);
    expect(nombreAlergeno('FRUTOS_DE_CASCARA')).toBe('Frutos de cáscara');
  });

  it('distingue sin indicar, ninguno y la lista', () => {
    expect(textoAlergenos(null)).toBe('Alérgenos: pregunta al personal');
    expect(textoAlergenos(undefined)).toBe('Alérgenos: pregunta al personal');
    expect(textoAlergenos([])).toBe('Sin alérgenos de declaración obligatoria');
    expect(textoAlergenos(['GLUTEN', 'LACTEOS'])).toBe('Contiene: Gluten, Lácteos');
  });

  it('con un filtro activo oculta lo que lleva ese alérgeno y lo que no tiene información', () => {
    const sinGluten = new Set(['GLUTEN']);
    expect(aptoSin(['LACTEOS'], sinGluten)).toBe(true);
    expect(aptoSin([], sinGluten)).toBe(true);
    expect(aptoSin(['GLUTEN', 'HUEVOS'], sinGluten)).toBe(false);
    expect(aptoSin(null, sinGluten)).toBe(false);
    expect(aptoSin(null, new Set())).toBe(true);
  });
});
