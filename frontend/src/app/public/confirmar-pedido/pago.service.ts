import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { environment } from 'src/environments/environment';

/** Lo que dice el servidor del pago con tarjeta: si lo hay, con qué clave publicable y si es de pruebas. */
export interface ConfiguracionPago {
  tarjeta: boolean;
  clavePublica: string | null;
  pruebas: boolean;
}

/** Intento de pago creado en el servidor por el importe que calcula él. */
export interface IntentoPago {
  id: string;
  clientSecret: string;
  importe: number;
}

export interface LineaPago {
  id_producto: number;
  cantidad: number;
}

/**
 * Pago con tarjeta: el servidor crea el intento de pago, Stripe.js lo confirma con la tarjeta (sus
 * datos van directos a Stripe) y el pedido se crea con el id del pago, que el servidor comprueba.
 */
@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly url = `${environment.urlBackendSpring}/pagos`;

  constructor(private readonly http: HttpClient) {}

  configuracion(): Observable<ConfiguracionPago> {
    return this.http.get<ConfiguracionPago>(`${this.url}/configuracion`);
  }

  /** Con la misma sesión que el pedido: el servidor ata el pago a quien lo hace. */
  crearIntento(detalles: LineaPago[]): Observable<IntentoPago> {
    const token = localStorage.getItem('token');
    return this.http.post<IntentoPago>(`${this.url}/intento`, { detalles }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` })
    });
  }

  /** Stripe.js solo se descarga si se va a pagar con tarjeta. */
  cargarStripe(clavePublica: string): Promise<Stripe | null> {
    return loadStripe(clavePublica);
  }
}
