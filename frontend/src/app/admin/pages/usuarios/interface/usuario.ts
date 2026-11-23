export interface Usuario {
    id?: number;
    username: string;
    email: string;
    password: string;
    passwordActual?: string;
    roles: Rol[];

    nombre?:string
    apellido1?:string
    apellido2?:string
    telefono?: string;
    calle?: string;
    tipoVivienda?: 'piso' | 'urbanizacion' | 'casa';
    portalNum?: string;
    pisoNum?: string;
    puerta?: string;
    urbanizacionNombre?: string;
    casaNum?: string;
    codigoPostal?: string;
    instruccionesEntrega?: string;
    imagen?: string;
    /** Solo en el listado del administrador: si tiene la verificación en dos pasos activada. */
    dosFactores?: boolean;
}
  
export interface Rol {
    id: number;
    nombre: string;
}  