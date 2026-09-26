import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { DetallesPedido } from "../interface/detalle";

@Injectable({ providedIn: 'root' })
export class DetallesService {
  private URL_DETALLES = `${environment.urlBackendSpring}/detalles_pedidos/`;

  constructor(private httpClient: HttpClient) { }

  get(): Observable<DetallesPedido[]> {
    return this.httpClient.get<DetallesPedido[]>(this.URL_DETALLES);
  }

  post(detalle: DetallesPedido): Observable<DetallesPedido> {
    return this.httpClient.post<DetallesPedido>(this.URL_DETALLES, detalle);
  }

  getId(id: string): Observable<DetallesPedido> {
    return this.httpClient.get<DetallesPedido>(`${this.URL_DETALLES}${id}`);
  }

  put(detalle: DetallesPedido): Observable<DetallesPedido> {
    return this.httpClient.put<DetallesPedido>(`${this.URL_DETALLES}${detalle.id}`, detalle);
  }

  del(id: number): Observable<string> {
    return this.httpClient.delete(`${this.URL_DETALLES}${id}`, { 
      responseType: 'text' 
    });
  }

  getByPedidoId(idPedido: number): Observable<DetallesPedido[]> {
    return this.httpClient.get<DetallesPedido[]>(`${this.URL_DETALLES}pedido/${idPedido}`);
  }
}