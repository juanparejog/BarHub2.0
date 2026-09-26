import { Pedido } from '../../pedidos/interface/pedido';

export interface Pago {
    id?: number;
    id_pedido?: number;
    metodo_pago: string;
    estado_pago: string;
    total: number;
    fecha_pago: string;
    created_at?: string;
    updated_at?: string;

    pedido?: Pedido;
}