import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { PerfilService, SesionAbiertaPerfil } from '../perfil.service';
import { describirNavegador, esMovil, fechaHora, haceCuanto } from './formato';
import { IdiomaService } from '../../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../../shared/i18n/traducir.pipe';

/** Sesiones abiertas de la cuenta (navegador, IP y actividad), con la opción de cerrarlas. */
@Component({
  selector: 'app-perfil-sesiones',
  standalone: true,
  imports: [TraducirPipe],
  templateUrl: './perfil-sesiones.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilSesionesComponent implements OnInit {
  private readonly perfil = inject(PerfilService);
  private readonly idiomas = inject(IdiomaService);

  readonly sesiones = signal<SesionAbiertaPerfil[] | null>(null);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly hayOtras = computed(() => (this.sesiones() ?? []).some(s => !s.actual));

  readonly esMovil = esMovil;

  describir(agente: string | null | undefined): string {
    return describirNavegador(agente, this.idiomas.idioma());
  }

  haceCuanto(instante: number): string {
    return haceCuanto(instante, Date.now(), this.idiomas.idioma());
  }

  fechaHora(instante: number): string {
    return fechaHora(instante, this.idiomas.idioma());
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.perfil.sesiones().subscribe({
      next: sesiones => this.sesiones.set(sesiones),
      error: () => this.error.set(this.idiomas.t('sesiones.errorCarga'))
    });
  }

  cerrar(sesion: SesionAbiertaPerfil): void {
    this.error.set('');
    this.aviso.set('');
    this.perfil.cerrarSesion(sesion.id).subscribe({
      next: () => {
        this.aviso.set(this.idiomas.t('sesiones.cerrada', { navegador: this.describir(sesion.agente) }));
        this.cargar();
      },
      error: () => this.error.set(this.idiomas.t('sesiones.errorCerrar'))
    });
  }

  cerrarLasDemas(): void {
    this.error.set('');
    this.aviso.set('');
    this.perfil.cerrarLasDemas().subscribe({
      next: cerradas => {
        this.aviso.set(this.idiomas.t(cerradas === 1 ? 'sesiones.cerradas1' : 'sesiones.cerradasN', { n: cerradas }));
        this.cargar();
      },
      error: () => this.error.set(this.idiomas.t('sesiones.errorCerrarVarias'))
    });
  }
}
