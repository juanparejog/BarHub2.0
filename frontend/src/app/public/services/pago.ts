// pago.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Pago {
  id: number;
  metodo_pago: string;
  estado_pago: string;
  total: number;
  fecha_pago: string;
  pedido: Pedido;
}

export interface Pedido {
  id: number;
  fecha: string;
  estado: string;
  total: number;
  detalles: DetallePedido[];
}

export interface DetallePedido {
  id: number;  
  cantidad: number;
  precio_unitario: number;
  producto: {
    id: number;
    nombre: string;
    descripcion?: string;
    precio?: number;
  }
}    

@Injectable({ providedIn: 'root' })
export class PagoService {
  private URL_PAGOS = 'http://localhost:8080/pagos';

  constructor(private http: HttpClient) {}

  getPagosPendientesEfectivo(): Observable<Pago[]> {
    return this.http.get<Pago[]>(`${this.URL_PAGOS}/pendientes/efectivo`);
  }

  marcarPagoComoCompletado(pago: Pago): Observable<Pago> {
    const actualizado = { ...pago, estado_pago: 'completado' };
    return this.http.put<Pago>(`${this.URL_PAGOS}/${pago.id}`, actualizado);
  }

  getPagosCompletados(): Observable<Pago[]> {
    return this.http.get<Pago[]>(`${this.URL_PAGOS}?estado_pago=completado`);
  }
}