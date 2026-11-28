import type { Idioma } from './idiomas';

/** Lo que hace falta de un producto para mostrarlo en otro idioma. */
export interface ProductoTraducible {
  nombre: string;
  descripcion?: string | null;
  nombrePt?: string | null;
  nombreEn?: string | null;
  descripcionPt?: string | null;
  descripcionEn?: string | null;
}

/** El nombre en el idioma pedido; si el bar no lo ha traducido, el de siempre (en español). */
export function nombreDe(producto: ProductoTraducible, idioma: Idioma): string {
  const traducciones: Partial<Record<Idioma, string | null | undefined>> = { pt: producto.nombrePt, en: producto.nombreEn };
  return traducciones[idioma]?.trim() || producto.nombre;
}

/** La descripción en el idioma pedido; si no está traducida, la de siempre (puede estar vacía). */
export function descripcionDe(producto: ProductoTraducible, idioma: Idioma): string {
  const traducciones: Partial<Record<Idioma, string | null | undefined>> = { pt: producto.descripcionPt, en: producto.descripcionEn };
  return traducciones[idioma]?.trim() || producto.descripcion || '';
}
