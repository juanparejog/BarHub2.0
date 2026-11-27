import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Turno, TurnoService, duracionTurno, fechaTurno, horaTurno } from '../../../services/turno.service';
import { PaginadorComponent } from '../../../shared/paginador/paginador.component';
import { paginar } from '../../../shared/paginador/paginar';

interface ResumenEmpleado {
  username: string;
  turnos: number;
  minutos: number;
}

/** AAAA-MM-DD en hora local (la del navegador), que es lo que espera el input de tipo fecha. */
function fechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Registro de jornada del personal: entradas, salidas y horas por empleado. */
@Component({
  selector: 'app-registro-jornada',
  standalone: true,
  imports: [FormsModule, PaginadorComponent],
  templateUrl: './registro-jornada.component.html',
  styleUrls: ['./registro-jornada.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class RegistroJornadaComponent implements OnInit {
  private readonly turnoService = inject(TurnoService);

  desde = '';
  hasta = '';
  turnos: Turno[] = [];
  resumen: ResumenEmpleado[] = [];
  cargando = false;
  error = '';

  /** Rango rápido (1, 7 o 30 días hasta hoy), o 0 si las fechas se han escrito a mano. */
  dias = 7;
  /** Empleado elegido en el resumen para ver solo sus turnos ('' para todos). */
  empleado = '';
  pagina = 1;
  tamano = 25;

  readonly hora = horaTurno;
  readonly fecha = fechaTurno;
  readonly duracion = duracionTurno;

  ngOnInit(): void {
    this.ponerRango(7);
    this.cargar();
  }

  elegirRango(dias: number): void {
    this.ponerRango(dias);
    this.cargar();
  }

  fechasAMano(): void {
    this.dias = 0;
  }

  private ponerRango(dias: number): void {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (dias - 1));
    this.desde = fechaLocal(desde);
    this.hasta = fechaLocal(hoy);
    this.dias = dias;
  }

  /** Pulsar un empleado del resumen enseña solo sus turnos; pulsarlo otra vez, todos. */
  elegirEmpleado(username: string): void {
    this.empleado = this.empleado === username ? '' : username;
    this.pagina = 1;
  }

  get turnosFiltrados(): Turno[] {
    return this.empleado ? this.turnos.filter(turno => turno.username === this.empleado) : this.turnos;
  }

  get turnosPagina(): Turno[] {
    return paginar(this.turnosFiltrados, this.pagina, this.tamano);
  }

  /** Minutos del empleado que más ha trabajado: la barra de cada uno se mide con ellos. */
  get maxMinutos(): number {
    return Math.max(1, ...this.resumen.map(empleado => empleado.minutos));
  }

  get minutosTotales(): number {
    return this.resumen.reduce((total, empleado) => total + empleado.minutos, 0);
  }

  inicial(username: string): string {
    return username.trim().charAt(0).toUpperCase() || '?';
  }

  claseEstado(turno: Turno): string {
    if (turno.salida === null) {
      return 'estado-en-curso';
    }
    return turno.cierre === 'TERMINADO' ? 'estado-terminado' : 'estado-automatico';
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.turnoService.listar(this.desde, this.hasta).subscribe({
      next: turnos => {
        this.turnos = turnos;
        this.resumen = this.resumir(turnos);
        if (this.empleado && !this.resumen.some(empleado => empleado.username === this.empleado)) {
          this.empleado = '';
        }
        this.pagina = 1;
        this.cargando = false;
      },
      error: err => {
        this.error = err?.error?.message ?? 'No se pudo cargar el registro de jornada.';
        this.turnos = [];
        this.resumen = [];
        this.cargando = false;
      }
    });
  }

  estado(turno: Turno): string {
    if (turno.salida === null) {
      return 'En curso';
    }
    return turno.cierre === 'TERMINADO' ? 'Terminado' : 'Cerrado sin fichar';
  }

  private resumir(turnos: Turno[]): ResumenEmpleado[] {
    const porEmpleado = new Map<string, ResumenEmpleado>();
    for (const turno of turnos) {
      const actual = porEmpleado.get(turno.username) ?? { username: turno.username, turnos: 0, minutos: 0 };
      actual.turnos++;
      actual.minutos += turno.duracionMinutos;
      porEmpleado.set(turno.username, actual);
    }
    return [...porEmpleado.values()].sort((a, b) => a.username.localeCompare(b.username));
  }
}
