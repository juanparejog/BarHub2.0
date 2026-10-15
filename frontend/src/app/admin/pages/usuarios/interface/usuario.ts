export interface Usuario {
    id?: number;
    username: string;
    email: string;
    password: string;
    roles: Rol[];

    nombre?:string
    apellido1?:string
    apellido2?:string
    telefono?: string;
    calle?: string;
    tipoVivienda?: 'piso' | 'urbanizacion' | 'casa' | string;
    portalNum?: string;
    pisoNum?: string;
    puerta?: string;
    urbanizacionNombre?: string;
    casaNum?: string;
    codigoPostal?: string;
    instruccionesEntrega?: string;
    imagen?: string;
}
  
export interface Rol {
    id: number;
    nombre: string;
}  