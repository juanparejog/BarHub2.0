/** Idiomas de las pantallas del cliente. El personal y la administración siguen en español. */
export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español', locale: 'es-ES' },
  { codigo: 'pt', nombre: 'Português', locale: 'pt-PT' },
  { codigo: 'en', nombre: 'English', locale: 'en-GB' }
] as const;

export type Idioma = typeof IDIOMAS[number]['codigo'];

export const IDIOMA_POR_DEFECTO: Idioma = 'es';

export function esIdioma(valor: unknown): valor is Idioma {
  return IDIOMAS.some(i => i.codigo === valor);
}

/** Configuración regional para fechas y precios (Intl). */
export function localeDe(idioma: Idioma): string {
  return IDIOMAS.find(i => i.codigo === idioma)?.locale ?? 'es-ES';
}
