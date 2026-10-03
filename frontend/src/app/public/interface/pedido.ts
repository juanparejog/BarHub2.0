import { Usuario } from '../../admin/pages/usuarios/interface/usuario';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';
import { DetallesPedido } from '../../admin/pages/detalles_pedidos/interface/detalle';

export enum EstadoPago {
    PENDIENTE = 'PENDIENTE',
    PAGADO = 'PAGADO',
    CANCELADO = 'CANCELADO'
  }
  
  export enum EstadoPedido {
    PENDIENTE = 'PENDIENTE',
    EN_PROCESO = 'EN_PROCESO',
    SERVIDO = 'SERVIDO',
    CANCELADO = 'CANCELADO'
  }
  
  export interface Pedido {
    id: number;
    userId?: number;
    mesaId?: number;
    tipoPedido: string;
    direccionEnvio?: string;
    telefonoContacto?: string;
    fecha: Date | string;
    estado: EstadoPedido;
    precioTotal: number;
    metodoPago?: string;
    estadoPago: EstadoPago;
    createdAt?: string;
    updatedAt?: string;
    detalles?: any[];
  }