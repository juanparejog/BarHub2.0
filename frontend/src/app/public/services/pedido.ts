import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Pedido, EstadoPago } from "../interface/pedido";
import { DetallesPedido } from '../../admin/pages/detalles_pedidos/interface/detalle';

interface PedidoDto {
  id: number;
  id_mesa?: number;
  idMesa?: number;
  mesaId?: number;
  
  // CAMPOS AÑADIDOS PARA TIPO DE PEDIDO Y DIRECCIÓN
  tipo_pedido?: string;
  tipoPedido?: string;
  direccion_envio?: string;
  direccionEnvio?: string;
  telefono_contacto?: string;
  telefonoContacto?: string;

  estado: string;
  fecha: string;
  precioTotal?: number;
  precio_total?: number;
  total?: number;
  metodoPago?: string;
  metodo_pago?: string;
  estadoPago?: EstadoPago;
  estado_pago?: EstadoPago;
  detalles: DetallePedidoDto[];
}

interface DetallePedidoDto {
  productoNombre?: string;
  cantidad: number;
  precioUnitario?: number;
  precio_unitario?: number;
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private baseUrl = environment.urlBackendSpring.replace(/\/+$/, '');
  private URL_PEDIDOS = `${this.baseUrl}/pedidos`;

  constructor(private httpClient: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  get(): Observable<Pedido[]> {
    return this.httpClient.get<PedidoDto[]>(this.URL_PEDIDOS, { headers: this.getAuthHeaders() }).pipe(
      map((pedidosDto) =>
        pedidosDto.map(dto => this.mapPedidoDtoToPedido(dto))
      )
    );
  }

  getPendientesEfectivo(): Observable<Pedido[]> {
    return this.httpClient.get<PedidoDto[]>(`${this.URL_PEDIDOS}/pendientes-efectivo`, { headers: this.getAuthHeaders() }).pipe(
      map((pedidosDto) =>
        pedidosDto.map(pedidoDto => this.mapPedidoDtoToPedido(pedidoDto))
      )
    );
  }

  post(pedido: Pedido): Observable<Pedido> {
    return this.httpClient.post<Pedido>(this.URL_PEDIDOS, pedido);
  }

  getId(id: number | string): Observable<Pedido> {
    return this.httpClient.get<Pedido>(`${this.URL_PEDIDOS}/${id}`);
  }

  put(pedido: any): Observable<Pedido> {
    return this.httpClient.put<Pedido>(`${this.URL_PEDIDOS}/${pedido.id}`, pedido, { headers: this.getAuthHeaders() });
  }

  del(pedido: Pedido): Observable<string> {
    return this.httpClient.delete(`${this.URL_PEDIDOS}/${pedido.id}`, { responseType: 'text' });
  }

  getPedidosByUsuario(idUsuario: number): Observable<Pedido[]> {
    return this.httpClient.get<PedidoDto[]>(`${this.URL_PEDIDOS}/usuario/${idUsuario}`, { headers: this.getAuthHeaders() }).pipe(
      map((pedidosDto) =>
        pedidosDto.map(pedidoDto => this.mapPedidoDtoToPedido(pedidoDto))
      )
    );
  }

  getMisPedidos(): Observable<Pedido[]> {
    return this.httpClient.get<Pedido[]>(`${this.URL_PEDIDOS}/mis-pedidos`, { headers: this.getAuthHeaders() });
  }

  private mapPedidoDtoToPedido(dto: PedidoDto): Pedido {
    const tipo = dto.tipoPedido ?? dto.tipo_pedido ?? '';
    const dir = dto.direccionEnvio ?? dto.direccion_envio ?? '';
    const tel = dto.telefonoContacto ?? dto.telefono_contacto ?? '';
    const mesa = dto.idMesa ?? dto.id_mesa ?? dto.mesaId ?? 0;

    return {
      id: dto.id,
      mesaId: mesa,
      id_mesa: mesa,
      
      // PRESERVAR PROPIEDADES DE MODALIDAD
      tipoPedido: tipo,
      tipo_pedido: tipo,
      direccionEnvio: dir,
      direccion_envio: dir,
      telefonoContacto: tel,
      telefono_contacto: tel,

      estado: dto.estado,
      fecha: dto.fecha,
      precioTotal: dto.precioTotal ?? dto.precio_total ?? dto.total ?? 0,
      metodoPago: dto.metodoPago ?? dto.metodo_pago,
      estadoPago: dto.estadoPago ?? dto.estado_pago,
      detalles: dto.detalles ? dto.detalles.map(det => this.mapDetalleDtoToDetalle(det)) : []
    } as unknown as Pedido;
  }

  private mapDetalleDtoToDetalle(dto: DetallePedidoDto): DetallesPedido {
    return {
      id_pedido: 0,
      id_producto: 0,
      cantidad: dto.cantidad,
      precio_unitario: dto.precioUnitario ?? dto.precio_unitario ?? 0,
      producto: {
        nombre: dto.productoNombre ?? ''
      } as any
    } as DetallesPedido;
  }
}