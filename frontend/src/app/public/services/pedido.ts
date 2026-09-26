import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Pedido } from "../interface/pedido";
import { DetallesPedido } from '../../admin/pages//detalles_pedidos/interface/detalle';

interface PedidoDto {
  id: number;
  id_mesa?: number;
  estado: string;
  fecha: string;
  total: number;
  detalles: DetallePedidoDto[];
}

interface DetallePedidoDto {
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private URL_PEDIDOS = `${environment.urlBackendSpring}/seguimientos`;

  constructor(private httpClient: HttpClient) { }

  get(): Observable<Pedido[]> {
    return this.httpClient.get<Pedido[]>(this.URL_PEDIDOS);
  }

  post(pedido: Pedido): Observable<Pedido> {
    return this.httpClient.post<Pedido>(this.URL_PEDIDOS, pedido);
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

  getPedidosByUsuario(idUsuario: number): Observable<Pedido[]> {
    return this.httpClient.get<PedidoDto[]>(`${this.URL_PEDIDOS}/usuario/${idUsuario}`).pipe(
      map((pedidosDto) =>
        pedidosDto.map(pedidoDto => this.mapPedidoDtoToPedido(pedidoDto))
      )
    );
  }

  private mapPedidoDtoToPedido(dto: PedidoDto): Pedido {
    return {
      id: dto.id,
      id_mesa: dto.id_mesa ?? 0,
      estado: dto.estado,
      fecha: dto.fecha,
      total: dto.total,
      detalles: dto.detalles.map(det => this.mapDetalleDtoToDetalle(det))
    } as Pedido;
  }

  private mapDetalleDtoToDetalle(dto: DetallePedidoDto): DetallesPedido {
    return {
      id_pedido: 0,
      id_producto: 0,
      cantidad: dto.cantidad,
      precio_unitario: dto.precioUnitario,
      producto: {
        nombre: dto.productoNombre
      } as any
    } as DetallesPedido;
  }
}