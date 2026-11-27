import { EN } from './textos.en';
import { ES, type Clave } from './textos.es';
import { PT } from './textos.pt';
import type { Idioma } from './idiomas';

export type { Clave } from './textos.es';
export type Parametros = Readonly<Record<string, string | number>>;

export const TEXTOS: Readonly<Record<Idioma, Readonly<Record<Clave, string>>>> = { es: ES, pt: PT, en: EN };

/** El texto de una clave en un idioma, con los datos entre llaves ya puestos. */
export function traducir(idioma: Idioma, clave: Clave, parametros?: Parametros): string {
  const texto = TEXTOS[idioma][clave] ?? ES[clave] ?? clave;
  if (!parametros) {
    return texto;
  }
  return texto.replaceAll(/\{(\w+)\}/g, (original, nombre: string) =>
    nombre in parametros ? String(parametros[nombre]) : original);
}

/** Para claves que se montan con un dato de la API (un estado, un tipo): si no existe, {@code porDefecto}. */
export function traducirSiExiste(idioma: Idioma, clave: string, porDefecto: string): string {
  return clave in ES ? traducir(idioma, clave as Clave) : porDefecto;
}
