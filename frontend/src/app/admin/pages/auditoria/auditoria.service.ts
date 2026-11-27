import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ResultadoAuditoria = 'CORRECTO' | 'RECHAZADO' | 'BLOQUEADO' | 'ERROR';

/** Una entrada del registro de auditoría (GET /auditoria). La fecha llega en milisegundos desde 1970. */
export interface EventoAuditoria {
  fecha: number;
  usuario: string | null;
  accion: string;
  resultado: ResultadoAuditoria;
  ip: string | null;
  objetivo: string | null;
  detalle: string | null;
  peticion: string | null;
}

export interface PaginaAuditoria {
  eventos: EventoAuditoria[];
  total: number;
  pagina: number;
  paginas: number;
}

/** Fechas AAAA-MM-DD (días completos, ambos incluidos); los textos vacíos no filtran. */
export interface FiltroAuditoria {
  desde: string;
  hasta: string;
  usuario: string;
  accion: string;
  resultado: string;
  pagina: number;
}

/** Nombres de las acciones, en el orden en que aparecen en el filtro. */
export const ACCIONES_AUDITORIA: Readonly<Record<string, string>> = {
  INICIO_SESION: 'Inicio de sesión',
  SEGUNDO_PASO: 'Segundo paso del inicio de sesión',
  CIERRE_SESION: 'Cierre de sesión',
  REAUTENTICACION: 'Confirmación de identidad',
  REGISTRO: 'Registro de cliente',
  CONTRASENA_CAMBIADA: 'Contraseña cambiada',
  CONTRASENA_RESTABLECIDA: 'Contraseña restablecida por correo',
  CORREO_CAMBIO_PEDIDO: 'Cambio de correo pedido',
  CORREO_CAMBIO_CANCELADO: 'Cambio de correo cancelado',
  CORREO_CAMBIADO: 'Correo cambiado',
  DOS_FACTORES_ACTIVADA: 'Verificación en dos pasos activada',
  DOS_FACTORES_DESACTIVADA: 'Verificación en dos pasos desactivada',
  CODIGOS_RECUPERACION_NUEVOS: 'Códigos de recuperación nuevos',
  DOS_FACTORES_RESTABLECIDA: 'Verificación en dos pasos restablecida',
  SESIONES_CERRADAS: 'Sesiones cerradas',
  DATOS_DESCARGADOS: 'Datos descargados',
  CUENTA_ELIMINADA: 'Cuenta eliminada',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_EDITADO: 'Usuario editado',
  USUARIO_BORRADO: 'Usuario borrado',
  CAJA_ABIERTA: 'Caja abierta',
  CAJA_CERRADA: 'Caja cerrada',
  ACCESO_DENEGADO: 'Acceso denegado'
};

export const RESULTADOS_AUDITORIA: Readonly<Record<ResultadoAuditoria, string>> = {
  CORRECTO: 'Correcto',
  RECHAZADO: 'Rechazado',
  BLOQUEADO: 'Bloqueado',
  ERROR: 'Error'
};

/** Entradas por página: las que devuelve el servidor en cada consulta. */
export const TAMANO_PAGINA_AUDITORIA = 50;

/** Registro de auditoría, solo lectura y solo para el administrador. */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlBackendSpring}/auditoria`;

  buscar(filtro: FiltroAuditoria): Observable<PaginaAuditoria> {
    let params = new HttpParams()
      .set('desde', filtro.desde)
      .set('hasta', filtro.hasta)
      .set('pagina', filtro.pagina)
      .set('tamano', TAMANO_PAGINA_AUDITORIA);
    for (const clave of ['usuario', 'accion', 'resultado'] as const) {
      const valor = filtro[clave].trim();
      if (valor) {
        params = params.set(clave, valor);
      }
    }
    return this.http.get<PaginaAuditoria>(this.url, { params });
  }
}
