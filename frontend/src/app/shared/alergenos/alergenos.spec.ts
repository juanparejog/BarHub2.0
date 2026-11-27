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

  it('en portugués y en inglés, con los nombres del reglamento en cada idioma', () => {
    expect(nombreAlergeno('FRUTOS_DE_CASCARA', 'pt')).toBe('Frutos de casca rija');
    expect(nombreAlergeno('ALTRAMUCES', 'en')).toBe('Lupin');
    expect(textoAlergenos(['GLUTEN', 'LACTEOS'], 'pt')).toBe('Contém: Glúten, Leite');
    expect(textoAlergenos(['HUEVOS', 'SULFITOS'], 'en')).toBe('Contains: Eggs, Sulphites');
    expect(textoAlergenos(null, 'en')).toBe('Allergens: ask the staff');
    expect(textoAlergenos([], 'pt')).toBe('Sem alergénios de declaração obrigatória');
    // Todos tienen nombre en los tres idiomas
    for (const { codigo } of ALERGENOS) {
      expect(nombreAlergeno(codigo, 'pt')).not.toBe(codigo);
      expect(nombreAlergeno(codigo, 'en')).not.toBe(codigo);
    }
    expect(nombreAlergeno('CHOCOLATE', 'en')).toBe('CHOCOLATE');
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
