import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Turno, TurnoService, duracionTurno, fechaTurno, horaTurno } from '../../../services/turno.service';

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
  imports: [FormsModule],
  templateUrl: './registro-jornada.component.html',
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

  readonly hora = horaTurno;
  readonly fecha = fechaTurno;
  readonly duracion = duracionTurno;

  ngOnInit(): void {
    const hoy = new Date();
    const haceUnaSemana = new Date(hoy);
    haceUnaSemana.setDate(hoy.getDate() - 6);
    this.desde = fechaLocal(haceUnaSemana);
    this.hasta = fechaLocal(hoy);
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.turnoService.listar(this.desde, this.hasta).subscribe({
      next: turnos => {
        this.turnos = turnos;
        this.resumen = this.resumir(turnos);
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
