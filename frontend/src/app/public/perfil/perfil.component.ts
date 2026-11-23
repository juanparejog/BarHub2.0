import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PerfilService } from './perfil.service';

/** Pestañas del perfil; cada una es una ruta hija de /perfil. */
export const PESTANAS_PERFIL = [
  { ruta: 'datos', titulo: 'Datos personales', icono: 'bi-person' },
  { ruta: 'direccion', titulo: 'Dirección de entrega', icono: 'bi-geo-alt' },
  { ruta: 'seguridad', titulo: 'Seguridad', icono: 'bi-shield-lock' }
] as const;

const NOMBRES_ROL: Record<string, string> = {
  ROLE_ADMIN: 'Administrador',
  ROLE_EMPLEADO: 'Empleado',
  ROLE_CLIENTE: 'Cliente'
};

/**
 * Mi perfil: cabecera con la foto, el nombre y el estado de la cuenta, y una pestaña por tema.
 * Las pestañas son rutas (/perfil/datos, /perfil/seguridad...), así que el botón «atrás» funciona y
 * se puede enlazar a una en concreto.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css'],
  providers: [PerfilService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilComponent implements OnInit {
  readonly perfil = inject(PerfilService);
  readonly pestanas = PESTANAS_PERFIL;

  readonly nombreCompleto = computed(() => {
    const u = this.perfil.usuario();
    return u ? [u.nombre, u.apellido1, u.apellido2].filter(Boolean).join(' ') || u.username : '';
  });
  readonly miembroDesde = computed(() => {
    const creada = this.perfil.seguridad()?.cuentaCreada;
    return creada ? new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(creada)) : '';
  });
  readonly roles = computed(() =>
    (this.perfil.usuario()?.roles ?? []).map(r => NOMBRES_ROL[r.nombre] ?? r.nombre));

  // ---------- foto ----------
  readonly mostrarModalImagen = signal(false);
  readonly arrastrando = signal(false);
  readonly vistaPrevia = signal<string | null>(null);
  readonly errorFoto = signal('');
  readonly subiendoFoto = signal(false);
  /** Para que el navegador no muestre la foto anterior de la caché tras cambiarla. */
  private readonly version = signal(0);
  private archivo: File | null = null;

  readonly urlFoto = computed(() => {
    const imagen = this.perfil.usuario()?.imagen;
    if (!imagen) {
      return 'assets/images/usuarios/default.jpg';
    }
    const version = this.version();
    return `assets/images/usuarios/${imagen}` + (version ? `?v=${version}` : '');
  });

  ngOnInit(): void {
    this.perfil.cargar();
  }

  fotoPorDefecto(evento: Event): void {
    (evento.target as HTMLImageElement).src = 'assets/images/usuarios/default.jpg';
  }

  abrirModalImagen(): void {
    this.archivo = null;
    this.vistaPrevia.set(null);
    this.errorFoto.set('');
    this.mostrarModalImagen.set(true);
  }

  cerrarModalImagen(): void {
    this.mostrarModalImagen.set(false);
  }

  alArrastrar(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.arrastrando.set(encima);
  }

  alSoltar(evento: DragEvent): void {
    this.alArrastrar(evento, false);
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) {
      this.elegirArchivo(archivo);
    }
  }

  alSeleccionar(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (archivo) {
      this.elegirArchivo(archivo);
    }
  }

  guardarFoto(): void {
    if (!this.archivo || this.subiendoFoto()) {
      return;
    }
    this.subiendoFoto.set(true);
    this.perfil.guardar({}, this.archivo).subscribe({
      next: () => {
        this.subiendoFoto.set(false);
        this.version.set(Date.now());
        this.mostrarModalImagen.set(false);
      },
      error: err => {
        this.subiendoFoto.set(false);
        this.errorFoto.set(err?.error?.message ?? 'No se pudo guardar la foto.');
      }
    });
  }

  private elegirArchivo(archivo: File): void {
    this.errorFoto.set('');
    if (!archivo.type.startsWith('image/')) {
      this.errorFoto.set('Elige un archivo de imagen (JPG, PNG o WebP).');
      return;
    }
    this.archivo = archivo;
    const lector = new FileReader();
    lector.onload = () => this.vistaPrevia.set(lector.result as string);
    lector.readAsDataURL(archivo);
  }
}
