import { Usuario } from '../../usuarios/interface/usuario';
import { Mesa } from '../../mesas/interface/mesa';
import { DetallesPedido } from '../../detalles_pedidos/interface/detalle';

export interface Pedido {
  id?: number;
  id_user?: number | null;
  id_mesa?: number | null;
  estado: string;
  fecha: string;

  total?: number;
  precio_total?: number;
  precioTotal?: number;
  
  tipo_pedido?: 'Mesa' | 'Domicilio' | 'Recoger' | string;
  direccion_envio?: string;
  direccion_tienda?: string;

  created_at?: string;
  updated_at?: string;
  usuario?: Usuario;
  mesa?: Mesa;
  detalles?: DetallesPedido[];
  paymentMethodId?: string;
}