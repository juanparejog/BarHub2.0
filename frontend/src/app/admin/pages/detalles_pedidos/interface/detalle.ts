import { Pedido } from '../../pedidos/interface/pedido';
import { Producto } from '../../productos/interface/producto';

export interface DetallesPedido {
    id?: number;
    id_pedido: number;
    id_producto: number;   
    cantidad: number;
    precio_unitario: number;
    created_at?: string;
    updated_at?: string;

    pedido?: Pedido;
    producto?: Producto;
}