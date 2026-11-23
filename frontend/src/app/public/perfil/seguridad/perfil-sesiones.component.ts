import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { PerfilService, SesionAbiertaPerfil } from '../perfil.service';
import { describirNavegador, esMovil, fechaHora, haceCuanto } from './formato';

/** Sesiones abiertas de la cuenta (navegador, IP y actividad), con la opción de cerrarlas. */
@Component({
  selector: 'app-perfil-sesiones',
  standalone: true,
  templateUrl: './perfil-sesiones.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilSesionesComponent implements OnInit {
  private readonly perfil = inject(PerfilService);

  readonly sesiones = signal<SesionAbiertaPerfil[] | null>(null);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly hayOtras = computed(() => (this.sesiones() ?? []).some(s => !s.actual));

  readonly describir = describirNavegador;
  readonly esMovil = esMovil;
  readonly haceCuanto = haceCuanto;
  readonly fechaHora = fechaHora;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.perfil.sesiones().subscribe({
      next: sesiones => this.sesiones.set(sesiones),
      error: () => this.error.set('No se pudieron cargar las sesiones abiertas.')
    });
  }

  cerrar(sesion: SesionAbiertaPerfil): void {
    this.error.set('');
    this.aviso.set('');
    this.perfil.cerrarSesion(sesion.id).subscribe({
      next: () => {
        this.aviso.set(`Sesión de ${describirNavegador(sesion.agente)} cerrada.`);
        this.cargar();
      },
      error: () => this.error.set('No se pudo cerrar la sesión.')
    });
  }

  cerrarLasDemas(): void {
    this.error.set('');
    this.aviso.set('');
    this.perfil.cerrarLasDemas().subscribe({
      next: cerradas => {
        this.aviso.set(cerradas === 1 ? 'Hemos cerrado 1 sesión.' : `Hemos cerrado ${cerradas} sesiones.`);
        this.cargar();
      },
      error: () => this.error.set('No se pudieron cerrar las sesiones.')
    });
  }
}
