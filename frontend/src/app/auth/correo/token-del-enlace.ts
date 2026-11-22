import { Location } from '@angular/common';

/**
 * Token de un enlace de correo ({@code /auth/verificar#token=...}). Va en el fragmento para que el
 * navegador no lo envie al servidor (no queda en los logs ni en el Referer).
 */
export function tokenDelFragmento(fragmento: string | null): string {
  return new URLSearchParams(fragmento ?? '').get('token') ?? '';
}

/** Quita el token de la barra de direcciones y del historial en cuanto se ha leido. */
export function borrarFragmento(location: Location): void {
  location.replaceState(location.path(false));
}
