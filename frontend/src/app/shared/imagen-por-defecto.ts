/** Imágenes que vienen con la aplicación y se usan cuando falta la de un producto o un usuario. */
export const IMAGEN_PRODUCTO_POR_DEFECTO = 'assets/images/productos/default.jpg';
export const IMAGEN_USUARIO_POR_DEFECTO = 'assets/images/usuarios/default.jpg';

/**
 * Para el evento (error) de un <img>: pone la imagen por defecto, una sola vez. Si también falla, no
 * lo vuelve a intentar: cambiar el src en cada error, a una imagen que tampoco existe, deja al
 * navegador pidiéndola sin parar (la página nunca termina de cargar y no deja de gastar red).
 */
export function ponerImagenPorDefecto(evento: Event, porDefecto: string): void {
  const imagen = evento.target as HTMLImageElement | null;
  if (!imagen || imagen.dataset['porDefecto'] === 'si') {
    return;
  }
  imagen.dataset['porDefecto'] = 'si';
  imagen.src = porDefecto;
}
