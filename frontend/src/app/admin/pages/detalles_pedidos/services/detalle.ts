import { Injectable } from "@angular/core";
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { DetallesPedido } from "../interface/detalle";

@Injectable({ providedIn: 'root' })
export class DetallesService {
  private URL_DETALLES = `${environment.urlBackendSpring}/detalles_pedidos/`;

  constructor(private httpClient: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`
    });
  }

  get(): Observable<DetallesPedido[]> {
    return this.httpClient.get<DetallesPedido[]>(this.URL_DETALLES, { headers: this.getHeaders() });
  }

  post(detalle: DetallesPedido): Observable<DetallesPedido> {
    return this.httpClient.post<DetallesPedido>(this.URL_DETALLES, detalle, { headers: this.getHeaders() });
  }

  getId(id: string | number): Observable<DetallesPedido> {
    return this.httpClient.get<DetallesPedido>(`${this.URL_DETALLES}${id}`, { headers: this.getHeaders() });
  }

  put(detalle: DetallesPedido): Observable<DetallesPedido> {
    return this.httpClient.put<DetallesPedido>(`${this.URL_DETALLES}${detalle.id}`, detalle, { headers: this.getHeaders() });
  }

  del(id: number): Observable<string> {
    return this.httpClient.delete(`${this.URL_DETALLES}${id}`, { 
      headers: this.getHeaders(),
      responseType: 'text' 
    });
  }

  getByPedidoId(idPedido: number): Observable<DetallesPedido[]> {
    return this.httpClient.get<DetallesPedido[]>(`${this.URL_DETALLES}pedido/${idPedido}`, { headers: this.getHeaders() });
  }
}