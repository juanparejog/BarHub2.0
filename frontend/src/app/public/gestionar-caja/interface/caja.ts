export interface Caja {
    id?: number;
    fechaApertura: string;
    fechaCierre?: string;
    montoInicial: number;
    ventasEfectivo?: number;
    ventasTarjeta?: number;
    efectivoReal?: number;
    efectivoEsperado?: number;
    diferencia?: number;
    estado: 'ABIERTA' | 'CERRADA';
    observaciones?: string;
    nombreUsuarioApertura: string;
    nombreUsuarioCierre?: string;
  }
  
  export interface AperturaCajaDTO {
    montoInicial: number;
    observaciones?: string;
  }
  
  export interface CierreCajaDTO {
    efectivoReal: number;
    observaciones?: string;
  }