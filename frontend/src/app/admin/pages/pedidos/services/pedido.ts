import { Injectable } from "@angular/core";
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { Pedido } from "../interface/pedido";
import { Socket } from 'ngx-socket-io';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private URL_PEDIDOS = `${environment.urlBackendSpring}/pedidos`;

  constructor(private socket: Socket, private httpClient: HttpClient) { }

  // Método auxiliar para obtener cabeceras con Token JWT
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`
    });
  }

  actualizarEstadoSocket(pedido: Pedido) {
    if (this.socket) {
      this.socket.emit('cambioEstadoPedido', pedido);
    }
  }

  onEstadoCambiado() {
    return this.socket.fromEvent<Pedido>('pedidoActualizado');
  }

  get(): Observable<Pedido[]> {
    return this.httpClient.get<Pedido[]>(`${this.URL_PEDIDOS}`, { headers: this.getHeaders() });
  }   

  post(pedido: Pedido): Observable<Pedido> {
    return this.httpClient.post<Pedido>(`${this.URL_PEDIDOS}`, pedido, { headers: this.getHeaders() });
  }

  getId(id: string | number): Observable<Pedido> {
    return this.httpClient.get<Pedido>(`${this.URL_PEDIDOS}/${id}`, { headers: this.getHeaders() });
  }

  put(pedido: Pedido): Observable<Pedido> {
    return this.httpClient.put<Pedido>(`${this.URL_PEDIDOS}/${pedido.id}`, pedido, { headers: this.getHeaders() });
  }

  del(pedido: Pedido): Observable<string> {
    return this.httpClient.delete(`${this.URL_PEDIDOS}/${pedido.id}`, { 
      headers: this.getHeaders(), 
      responseType: 'text' 
    });
  }

  getDetallesPedidos(): Observable<Pedido[]> {
    return this.httpClient.get<Pedido[]>(`${this.URL_PEDIDOS}/getAllDetalles`, { 
      headers: this.getHeaders() 
    });
  }

  postCrearSeguro(dto: any): Observable<any> {
    return this.httpClient.post<any>(`${this.URL_PEDIDOS}`, dto, { 
      headers: this.getHeaders() 
    });
  }
}