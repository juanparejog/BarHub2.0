import { Injectable } from '@angular/core';

/**
 * Dibuja un codigo QR como imagen (data URL PNG). La libreria se carga solo cuando hace falta,
 * en la pantalla de configurar la verificacion en dos pasos, y no pesa en el resto de la web.
 * Va en un servicio aparte para que los tests lo sustituyan sin cargar la libreria.
 */
@Injectable({ providedIn: 'root' })
export class CodigoQrService {
  async comoImagen(texto: string): Promise<string> {
    const modulo: typeof import('qrcode') & { default?: typeof import('qrcode') } = await import('qrcode');
    const qrcode = modulo.default ?? modulo;
    return qrcode.toDataURL(texto, { errorCorrectionLevel: 'M', margin: 1, width: 208 });
  }
}
