import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { DialogService } from '../main/services/shared/services/dialog.service';

/** Turno del registro de jornada. Las horas llegan en milisegundos desde 1970. */
export interface Turno {
  id: number;
  usuarioId: number;
  username: string;
  entrada: number;
  salida: number | null;
  duracionMinutos: number;
  cierre: 'TERMINADO' | 'AUTOMATICO' | null;
}

export function horaTurno(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function fechaTurno(ms: number): string {
  return new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function duracionTurno(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return horas > 0 ? `${horas} h ${resto} min` : `${resto} min`;
}

/** Registro de jornada: el turno del empleado y el listado para el administrador. */
@Injectable({ providedIn: 'root' })
export class TurnoService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly url = `${environment.urlBackendSpring}/turnos`;

  /** El turno en curso, o null si no hay ninguno (el backend responde 204). */
  actual(): Observable<Turno | null> {
    return this.http.get<Turno | null>(`${this.url}/actual`);
  }

  terminar(): Observable<Turno> {
    return this.http.post<Turno>(`${this.url}/terminar`, null);
  }

  /** Fechas en formato AAAA-MM-DD, ambas incluidas. */
  listar(desde: string, hasta: string): Observable<Turno[]> {
    return this.http.get<Turno[]>(this.url, { params: { desde, hasta } });
  }

  /**
   * "Terminar turno" del menu: pide confirmacion con la hora de entrada, registra la salida y
   * cierra la sesion.
   */
  pedirFinDeTurno(): void {
    this.actual().subscribe({
      next: turno => {
        const detalle = turno
          ? ` Entraste a las ${horaTurno(turno.entrada)} (${duracionTurno(turno.duracionMinutos)}).`
          : '';
        this.dialogService.solicitarConfirmacion(
          `Se registrará tu salida ahora y se cerrará la sesión.${detalle}`,
          'Terminar turno',
          () => this.registrarFinDeTurno());
      },
      error: () => this.dialogService.mostrarToast('No se pudo consultar tu turno. Inténtalo de nuevo.')
    });
  }

  private registrarFinDeTurno(): void {
    this.terminar().subscribe({
      next: turno => {
        const salida = turno.salida ? horaTurno(turno.salida) : horaTurno(Date.now());
        this.dialogService.mostrarToast(`Turno terminado a las ${salida} (${duracionTurno(turno.duracionMinutos)}).`);
        this.authService.logout();
      },
      error: () => this.dialogService.mostrarToast('No se pudo registrar el fin del turno. Inténtalo de nuevo.')
    });
  }
}
