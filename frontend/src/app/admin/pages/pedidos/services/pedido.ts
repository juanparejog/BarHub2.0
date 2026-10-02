import { Injectable } from "@angular/core";
import { HttpHeaders } from '@angular/common/http';
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Pedido } from "../interface/pedido";
import { Socket } from 'ngx-socket-io';


@Injectable({ providedIn: 'root' })
export class PedidoService {
  private URL_PEDIDOS = `${environment.urlBackendSpring}/pedidos`;

  constructor(private socket: Socket, private httpClient: HttpClient) { }

  // Emitir actualización
  actualizarEstadoSocket(pedido: Pedido) {
    this.socket.emit('cambioEstadoPedido', pedido);
  }

  // Escuchar actualizaciones globales
  onEstadoCambiado() {
    return this.socket.fromEvent<Pedido>('pedidoActualizado');
  }

  get(): Observable<Pedido[]> {
    return this.httpClient.get<Pedido[]>(`${this.URL_PEDIDOS}/`);
  }  

  post(pedido: Pedido): Observable<Pedido> {
    return this.httpClient.post<Pedido>(`${this.URL_PEDIDOS}/`, pedido);
  }

  getId(id: string): Observable<Pedido> {
    return this.httpClient.get<Pedido>(`${this.URL_PEDIDOS}/${id}`);
  }

  put(pedido: Pedido): Observable<Pedido> {
    return this.httpClient.put<Pedido>(`${this.URL_PEDIDOS}/${pedido.id}`, pedido);
  }

  del(pedido: Pedido): Observable<string> {
    return this.httpClient.delete(`${this.URL_PEDIDOS}/${pedido.id}`, { responseType: 'text' });
  }

  getDetallesPedidos(): Observable<Pedido[]> {
    return this.httpClient.get<Pedido[]>(`${this.URL_PEDIDOS}/getAllDetalles`);
  }

  postCrearSeguro(dto: any): Observable<any> {
    const token = localStorage.getItem('token'); 
  
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  
    return this.httpClient.post<any>(
      `${this.URL_PEDIDOS}`, 
      dto, 
      { headers }
    );
  }
}