import { Usuario } from '../../admin/pages/usuarios/interface/usuario';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';
import { DetallesPedido } from '../../admin/pages/detalles_pedidos/interface/detalle';

export interface Pedido {
    id?: number;
    id_user?: number | null;
    id_mesa: number;   
    estado: string;
    fecha: string;
    total: number;
    created_at?: string;
    updated_at?: string;

    usuario?: Usuario;
    mesa?: Mesa;
    detalles?: DetallesPedido[];
}