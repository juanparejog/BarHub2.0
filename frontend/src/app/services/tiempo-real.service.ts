import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** «personal»: comandas, mesas y pagos (empleados y administradores). «mis-pedidos»: los del cliente. */
export type CanalTiempoReal = 'personal' | 'mis-pedidos';

/** Sin conexión en tiempo real, se recarga con esta frecuencia, como antes. */
export const RESPALDO_SIN_CONEXION_MS = 5_000;
/** Con conexión, una recarga de seguridad de vez en cuando por si se perdiera algún aviso. */
export const RESPALDO_CON_CONEXION_MS = 60_000;
/** Los avisos que llegan juntos (un pedido y sus líneas) se agrupan en una sola recarga. */
export const AGRUPAR_MS = 250;
const ESPERA_MAXIMA_MS = 30_000;

/**
 * Avisos del servidor en tiempo real (Server-Sent Events) para no tener que preguntar cada pocos
 * segundos. Se lee con fetch y no con EventSource porque EventSource no deja enviar la cabecera
 * Authorization: así el token no va en la URL (ni en los logs).
 *
 * Los avisos solo dicen que algo ha cambiado: la pantalla vuelve a pedir los datos por los
 * endpoints de siempre. Si la conexión se corta, se reconecta sola (esperando cada vez más, hasta
 * 30 s) y mientras tanto se recarga cada 5 s, como antes.
 */
@Injectable({ providedIn: 'root' })
export class TiempoRealService {
  private readonly authService = inject(AuthService);

  /**
   * Emite cuando hay que recargar: al suscribirse, con cada aviso (agrupando ráfagas), al
   * reconectar y, de respaldo, cada 5 s sin conexión o cada 60 s con ella.
   */
  recargas(canal: CanalTiempoReal): Observable<void> {
    return new Observable<void>(suscriptor => {
      let cerrado = false;
      let conectado = false;
      let espera = 1_000;
      let controlador: AbortController | null = null;
      let reintento: ReturnType<typeof setTimeout> | null = null;
      let agrupando: ReturnType<typeof setTimeout> | null = null;

      const avisar = () => {
        agrupando ??= setTimeout(() => {
          agrupando = null;
          suscriptor.next();
        }, AGRUPAR_MS);
      };
      const sinConexion = setInterval(() => {
        if (!conectado) {
          suscriptor.next();
        }
      }, RESPALDO_SIN_CONEXION_MS);
      const conConexion = setInterval(() => {
        if (conectado) {
          suscriptor.next();
        }
      }, RESPALDO_CON_CONEXION_MS);

      const conectar = async (): Promise<void> => {
        if (cerrado) {
          return;
        }
        controlador = new AbortController();
        try {
          const respuesta = await fetch(`${environment.urlBackendSpring}/eventos/${canal}`, {
            headers: { Authorization: `Bearer ${this.authService.getToken() ?? ''}`, Accept: 'text/event-stream' },
            cache: 'no-store',
            signal: controlador.signal
          });
          if (!respuesta.ok || !respuesta.body) {
            throw new Error(`HTTP ${respuesta.status}`);
          }
          conectado = true;
          espera = 1_000;
          // Lo que cambió mientras no había conexión
          suscriptor.next();
          await leerAvisos(respuesta.body, avisar);
        } catch {
          // Cortada, sin red o token caducado: la recarga de respaldo (con HttpClient) lo renueva
        }
        conectado = false;
        if (!cerrado) {
          reintento = setTimeout(() => void conectar(), espera);
          espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
        }
      };

      suscriptor.next();
      void conectar();

      return () => {
        cerrado = true;
        controlador?.abort();
        clearInterval(sinConexion);
        clearInterval(conConexion);
        if (reintento) {
          clearTimeout(reintento);
        }
        if (agrupando) {
          clearTimeout(agrupando);
        }
      };
    });
  }
}

/** Lee el flujo de eventos y llama a {@code avisar} por cada aviso de pedido o mesa. */
export async function leerAvisos(cuerpo: ReadableStream<Uint8Array>, avisar: () => void): Promise<void> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  let resto = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) {
      return;
    }
    resto += decodificador.decode(value, { stream: true }).replaceAll('\r\n', '\n');
    const bloques = resto.split('\n\n');
    resto = bloques.pop() ?? '';
    if (bloques.some(esAviso)) {
      avisar();
    }
  }
}

/** Un bloque SSE es un aviso si su evento es «pedido» o «mesa» (no «conectado» ni los latidos). */
export function esAviso(bloque: string): boolean {
  return bloque.split('\n').some(linea => /^event:\s*(pedido|mesa)\s*$/.test(linea));
}
