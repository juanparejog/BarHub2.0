import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ACCIONES_AUDITORIA, AuditoriaService, EventoAuditoria, FiltroAuditoria, RESULTADOS_AUDITORIA, ResultadoAuditoria
} from './auditoria.service';

/** AAAA-MM-DD en hora local, que es lo que espera el input de tipo fecha. */
function fechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const CLASES_RESULTADO: Record<ResultadoAuditoria, string> = {
  CORRECTO: 'text-bg-success',
  RECHAZADO: 'text-bg-warning',
  BLOQUEADO: 'text-bg-danger',
  ERROR: 'text-bg-dark'
};

/**
 * Registro de auditoría: quién hizo qué, cuándo, desde qué IP y con qué resultado (inicios de
 * sesión, cambios de contraseña y de correo, verificación en dos pasos, usuarios, caja, accesos
 * denegados...). Solo lectura.
 */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auditoria.component.html',
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

  ngOnInit(): void {
    const hoy = new Date();
    const haceUnaSemana = new Date(hoy);
    haceUnaSemana.setDate(hoy.getDate() - 6);
    this.filtro.desde = fechaLocal(haceUnaSemana);
    this.filtro.hasta = fechaLocal(hoy);
    this.buscar();
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
    return CLASES_RESULTADO[resultado] ?? 'text-bg-secondary';
  }

  fechaHora(ms: number): string {
    return new Date(ms).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
