export interface Usuario {
    id?: number;
    username: string;
    email: string;
    password: string;
    roles: Rol[];
}
  
export interface Rol {
    id: number;
    nombre: string;
}  