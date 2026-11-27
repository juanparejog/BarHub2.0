import { IMAGEN_USUARIO_POR_DEFECTO, ponerImagenPorDefecto } from '../../shared/imagen-por-defecto';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PerfilService } from './perfil.service';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

/** Pestañas del perfil; cada una es una ruta hija de /perfil. */
export const PESTANAS_PERFIL = [
  { ruta: 'datos', titulo: 'Datos personales', clave: 'perfil.pestana.datos', icono: 'bi-person' },
  { ruta: 'direccion', titulo: 'Dirección de entrega', clave: 'perfil.pestana.direccion', icono: 'bi-geo-alt' },
  { ruta: 'cuenta', titulo: 'Cuenta y correo', clave: 'perfil.pestana.cuenta', icono: 'bi-envelope' },
  { ruta: 'seguridad', titulo: 'Seguridad', clave: 'perfil.pestana.seguridad', icono: 'bi-shield-lock' },
  { ruta: 'privacidad', titulo: 'Privacidad', clave: 'perfil.pestana.privacidad', icono: 'bi-incognito' }
] as const;


/**
 * Mi perfil: cabecera con la foto, el nombre y el estado de la cuenta, y una pestaña por tema.
 * Las pestañas son rutas (/perfil/datos, /perfil/seguridad...), así que el botón «atrás» funciona y
 * se puede enlazar a una en concreto.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TraducirPipe],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css'],
  providers: [PerfilService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilComponent implements OnInit {
  readonly perfil = inject(PerfilService);
  private readonly idiomas = inject(IdiomaService);
  readonly pestanas = PESTANAS_PERFIL;

  readonly nombreCompleto = computed(() => {
    const u = this.perfil.usuario();
    return u ? [u.nombre, u.apellido1, u.apellido2].filter(Boolean).join(' ') || u.username : '';
  });
  readonly miembroDesde = computed(() => {
    const creada = this.perfil.seguridad()?.cuentaCreada;
    return creada ? this.idiomas.fecha(creada, { month: 'long', year: 'numeric' }) : '';
  });
  readonly roles = computed(() =>
    (this.perfil.usuario()?.roles ?? []).map(r => this.idiomas.tSiExiste(`rol.${r.nombre}`, r.nombre)));

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
    ponerImagenPorDefecto(evento, IMAGEN_USUARIO_POR_DEFECTO);
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
        this.errorFoto.set(this.idiomas.delServidor(err?.error?.message, 'perfil.foto.error'));
      }
    });
  }

  private elegirArchivo(archivo: File): void {
    this.errorFoto.set('');
    if (!archivo.type.startsWith('image/')) {
      this.errorFoto.set(this.idiomas.t('perfil.foto.tipo'));
      return;
    }
    this.archivo = archivo;
    const lector = new FileReader();
    lector.onload = () => this.vistaPrevia.set(lector.result as string);
    lector.readAsDataURL(archivo);
  }
}
