/** Hueco entre números en la lista de páginas: «1 … 7 8 9 … 20». */
export const HUECO = '…' as const;

/** Número de páginas para un total de elementos (siempre al menos 1). */
export function totalPaginas(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, tamano)));
}

/** La página pedida dentro de los límites: si se borra lo último de la última página, se queda en la anterior. */
export function paginaValida(pagina: number, total: number, tamano: number): number {
  const ultima = totalPaginas(total, tamano);
  return Math.min(Math.max(1, Math.trunc(pagina) || 1), ultima);
}

/** Los elementos de una página (la primera es la 1). */
export function paginar<T>(lista: readonly T[], pagina: number, tamano: number): T[] {
  const actual = paginaValida(pagina, lista.length, tamano);
  const inicio = (actual - 1) * tamano;
  return lista.slice(inicio, inicio + tamano);
}

/**
 * Páginas que se enseñan como botones: siempre la primera y la última, y la actual con sus
 * vecinas; los huecos se marcan con {@link HUECO}. Con 7 o menos se ven todas.
 */
export function paginasVisibles(actual: number, ultima: number): (number | typeof HUECO)[] {
  if (ultima <= 7) {
    return Array.from({ length: ultima }, (_, i) => i + 1);
  }
  let desde = Math.max(2, Math.min(actual - 1, ultima - 4));
  let hasta = Math.min(ultima - 1, Math.max(actual + 1, 5));
  // Un hueco que solo esconderia una pagina no ahorra nada: se pone el numero
  if (desde === 3) {
    desde = 2;
  }
  if (hasta === ultima - 2) {
    hasta = ultima - 1;
  }
  const paginas: (number | typeof HUECO)[] = [1];
  if (desde > 2) {
    paginas.push(HUECO);
  }
  for (let n = desde; n <= hasta; n++) {
    paginas.push(n);
  }
  if (hasta < ultima - 1) {
    paginas.push(HUECO);
  }
  paginas.push(ultima);
  return paginas;
}
