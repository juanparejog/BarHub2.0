import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Pago {
  id: number;
  metodo_pago?: string;
  estado_pago?: string;
  total?: number;
  fecha_pago?: string;
  pedido?: Pedido;
  id_pedido?: number;
  precioTotal?: number;
  paymentMethodId?: string;
  estado?: string;
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
  };
}    

@Injectable({ providedIn: 'root' })
export class PagoService {
  private URL = 'http://localhost:8080/pedidos';

  constructor(private http: HttpClient) {}

  getPagosPendientesEfectivo(): Observable<any[]> {
    return this.http.get<any[]>(this.URL).pipe(
      map(pedidos => pedidos.filter(p => {
        const metodo = (p.paymentMethodId || p.payment_method_id || '').toUpperCase();
        const estado = (p.estado || '').toUpperCase();
        
        return metodo === 'EFECTIVO' && estado === 'PENDIENTE';
      }))
    );
  }

  marcarPagoComoCompletado(pago: Pago): Observable<any> {
    const pedidoId = pago.id_pedido || pago.pedido?.id || pago.id;
  
    const payload = {
      estado: 'completado',
      precioTotal: pago.total || (pago as any).precioTotal || 0,
      direccionEnvio: (pago as any).direccionEnvio || null,
      telefonoContacto: (pago as any).telefonoContacto || null
    };
  
    return this.http.put<any>(`${this.URL}/${pedidoId}`, payload);
  }

  getPagosCompletados(): Observable<any[]> {
    return this.http.get<any[]>(this.URL).pipe(
      map(pedidos => pedidos.filter(p => {
        const metodo = (p.paymentMethodId || p.payment_method_id || '').toUpperCase();
        const estado = (p.estado || '').toUpperCase();
        
        return metodo === 'EFECTIVO' && estado === 'COMPLETADO';
      }))
    );
  }
}