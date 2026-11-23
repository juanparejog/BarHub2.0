import { Injectable } from '@angular/core';

/**
 * Dibuja un codigo QR como imagen (data URL PNG) en el navegador, sin servicios de fuera. La
 * libreria se carga solo cuando hace falta (configurar la verificacion en dos pasos, QR de las
 * mesas) y no pesa en el resto de la web. Va en un servicio aparte para que los tests lo
 * sustituyan sin cargar la libreria.
 */
@Injectable({ providedIn: 'root' })
export class CodigoQrService {
  async comoImagen(texto: string, ancho = 208): Promise<string> {
    const modulo: typeof import('qrcode') & { default?: typeof import('qrcode') } = await import('qrcode');
    const qrcode = modulo.default ?? modulo;
    return qrcode.toDataURL(texto, { errorCorrectionLevel: 'M', margin: 1, width: ancho });
  }
}
