import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaginadorComponent } from '../../../shared/paginador/paginador.component';
import {
  ACCIONES_AUDITORIA, AuditoriaService, EventoAuditoria, FiltroAuditoria, RESULTADOS_AUDITORIA, ResultadoAuditoria,
  TAMANO_PAGINA_AUDITORIA
} from './auditoria.service';

/** AAAA-MM-DD en hora local, que es lo que espera el input de tipo fecha. */
function fechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const CLASES_RESULTADO: Record<ResultadoAuditoria, string> = {
  CORRECTO: 'resultado-correcto',
  RECHAZADO: 'resultado-rechazado',
  BLOQUEADO: 'resultado-bloqueado',
  ERROR: 'resultado-error'
};

const ICONOS_RESULTADO: Record<ResultadoAuditoria, string> = {
  CORRECTO: 'bi-check-circle-fill',
  RECHAZADO: 'bi-x-circle-fill',
  BLOQUEADO: 'bi-lock-fill',
  ERROR: 'bi-exclamation-octagon-fill'
};

/** Icono de cada acción, por grupos: sesiones, cuenta, verificación, usuarios, caja y accesos. */
const ICONOS_ACCION: Readonly<Record<string, string>> = {
  INICIO_SESION: 'bi-box-arrow-in-right',
  SEGUNDO_PASO: 'bi-phone',
  CIERRE_SESION: 'bi-box-arrow-right',
  REAUTENTICACION: 'bi-person-check',
  REGISTRO: 'bi-person-plus',
  CONTRASENA_CAMBIADA: 'bi-key',
  CONTRASENA_RESTABLECIDA: 'bi-key',
  CORREO_CAMBIO_PEDIDO: 'bi-envelope',
  CORREO_CAMBIO_CANCELADO: 'bi-envelope-x',
  CORREO_CAMBIADO: 'bi-envelope-check',
  DOS_FACTORES_ACTIVADA: 'bi-shield-lock',
  DOS_FACTORES_DESACTIVADA: 'bi-shield-slash',
  CODIGOS_RECUPERACION_NUEVOS: 'bi-shield-lock',
  DOS_FACTORES_RESTABLECIDA: 'bi-shield-exclamation',
  SESIONES_CERRADAS: 'bi-laptop',
  DATOS_DESCARGADOS: 'bi-download',
  CUENTA_ELIMINADA: 'bi-person-x',
  USUARIO_CREADO: 'bi-person-plus',
  USUARIO_EDITADO: 'bi-person-gear',
  USUARIO_BORRADO: 'bi-person-x',
  CAJA_ABIERTA: 'bi-cash-coin',
  CAJA_CERRADA: 'bi-cash-coin',
  ACCESO_DENEGADO: 'bi-slash-circle'
};

/**
 * Registro de auditoría: quién hizo qué, cuándo, desde qué IP y con qué resultado (inicios de
 * sesión, cambios de contraseña y de correo, verificación en dos pasos, usuarios, caja, accesos
 * denegados...). Solo lectura.
 */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [FormsModule, PaginadorComponent],
  templateUrl: './auditoria.component.html',
  styleUrls: ['./auditoria.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditoriaComponent implements OnInit {
  private readonly auditoria = inject(AuditoriaService);

  readonly acciones = Object.entries(ACCIONES_AUDITORIA);
  readonly resultados = Object.entries(RESULTADOS_AUDITORIA);

  readonly filtro: FiltroAuditoria = { desde: '', hasta: '', usuario: '', accion: '', resultado: '', pagina: 0 };
  readonly eventos = signal<EventoAuditoria[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly paginas = signal(0);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly tamano = TAMANO_PAGINA_AUDITORIA;
  /** Rango rápido elegido (1, 7 o 30 días hasta hoy), o 0 si se han escrito las fechas a mano. */
  readonly dias = signal(7);

  ngOnInit(): void {
    this.ponerRango(7);
    this.buscar();
  }

  /** Hoy, los últimos 7 días o los últimos 30, contando hoy. */
  elegirRango(dias: number): void {
    this.ponerRango(dias);
    this.buscar();
  }

  /** Al escribir una fecha a mano ya no hay rango rápido marcado. */
  fechasAMano(): void {
    this.dias.set(0);
  }

  private ponerRango(dias: number): void {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (dias - 1));
    this.filtro.desde = fechaLocal(desde);
    this.filtro.hasta = fechaLocal(hoy);
    this.dias.set(dias);
  }

  /** Con los filtros nuevos se vuelve a la primera página. */
  buscar(): void {
    this.irA(0);
  }

  irA(pagina: number): void {
    this.cargando.set(true);
    this.error.set('');
    this.auditoria.buscar({ ...this.filtro, pagina }).subscribe({
      next: resultado => {
        this.eventos.set(resultado.eventos);
        this.total.set(resultado.total);
        this.pagina.set(resultado.pagina);
        this.paginas.set(resultado.paginas);
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el registro de auditoría.');
        this.eventos.set([]);
        this.total.set(0);
        this.paginas.set(0);
        this.cargando.set(false);
      }
    });
  }

  nombreAccion(accion: string): string {
    return ACCIONES_AUDITORIA[accion] ?? accion;
  }

  nombreResultado(resultado: ResultadoAuditoria): string {
    return RESULTADOS_AUDITORIA[resultado] ?? resultado;
  }

  claseResultado(resultado: ResultadoAuditoria): string {
    return CLASES_RESULTADO[resultado] ?? 'resultado-error';
  }

  iconoResultado(resultado: ResultadoAuditoria): string {
    return ICONOS_RESULTADO[resultado] ?? 'bi-question-circle';
  }

  iconoAccion(accion: string): string {
    return ICONOS_ACCION[accion] ?? 'bi-journal-text';
  }

  /** Inicial del usuario para su círculo («?» si no se sabe quién era). */
  inicial(usuario: string | null): string {
    return (usuario ?? '?').trim().charAt(0).toUpperCase() || '?';
  }

  fecha(ms: number): string {
    return new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  hora(ms: number): string {
    return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  fechaHora(ms: number): string {
    return new Date(ms).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
