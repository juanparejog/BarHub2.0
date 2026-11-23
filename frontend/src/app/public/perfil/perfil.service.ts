import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario } from '../../admin/pages/usuarios/interface/usuario';
import { UsuarioService } from '../../admin/pages/usuarios/services/usuario';

/** Estado de la pestaña Seguridad (GET /perfil/seguridad). */
export interface EstadoSeguridad {
  correoVerificado: boolean;
  dosFactoresActiva: boolean;
  dosFactoresObligatoria: boolean;
  codigosRecuperacionRestantes: number;
  /** Alta de la cuenta, en milisegundos desde 1970. */
  cuentaCreada: number | null;
  /** El correo nuevo que espera a que se abra el enlace enviado a él, o null. */
  cambioCorreoPendiente: string | null;
}

export interface SesionAbiertaPerfil {
  id: string;
  creada: number;
  ultimaActividad: number;
  ip: string | null;
  agente: string | null;
  /** La de este navegador. */
  actual: boolean;
}

/**
 * Datos del perfil compartidos por la cabecera y las pestañas (se provee en PerfilComponent, así que
 * vive mientras se está en /perfil). Cada pestaña guarda solo lo suyo, pero el backend recibe el
 * perfil completo: se parte siempre del último guardado.
 */
@Injectable()
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly usuarios = inject(UsuarioService);
  private readonly url = `${environment.urlBackendSpring}/perfil`;

  readonly usuario = signal<Usuario | null>(null);
  readonly seguridad = signal<EstadoSeguridad | null>(null);
  readonly error = signal('');

  cargar(): void {
    const id = localStorage.getItem('usuarioId') || localStorage.getItem('id');
    if (!id) {
      this.error.set('No se ha encontrado una sesión activa. Por favor, inicia sesión de nuevo.');
      return;
    }
    this.usuarios.getId(id).subscribe({
      next: usuario => this.usuario.set(usuario),
      error: () => this.error.set('No se pudieron cargar los datos del perfil.')
    });
    this.cargarSeguridad();
  }

  cargarSeguridad(): void {
    this.http.get<EstadoSeguridad>(`${this.url}/seguridad`).subscribe({
      next: estado => this.seguridad.set(estado),
      error: () => this.seguridad.set(null)
    });
  }

  /** Guarda los cambios sobre el último perfil guardado (y la foto, si se pasa). No toca la contraseña. */
  guardar(cambios: Partial<Usuario>, foto?: File | null): Observable<Usuario> {
    const actual = this.usuario();
    if (!actual) {
      throw new Error('El perfil aún no se ha cargado');
    }
    const completo: Usuario = { ...actual, ...cambios, password: '', passwordActual: undefined };
    return this.usuarios.put(completo, foto).pipe(
      tap(guardado => {
        this.usuario.set(guardado);
        if (guardado.imagen) {
          // El menú lee la foto de aquí
          localStorage.setItem('imagen', `assets/images/usuarios/${guardado.imagen}`);
        }
      })
    );
  }

  cambiarPassword(actual: string, nueva: string): Observable<number> {
    return this.http.put<{ sesionesCerradas: number }>(`${this.url}/password`, { actual, nueva })
      .pipe(map(r => r.sesionesCerradas));
  }

  configurarDosFactores(): Observable<{ secreto: string; uri: string }> {
    return this.http.post<{ secreto: string; uri: string }>(`${this.url}/dos-factores/configurar`, null);
  }

  activarDosFactores(codigo: string): Observable<string[]> {
    return this.http.post<{ codigosRecuperacion: string[] }>(`${this.url}/dos-factores/activar`, { codigo })
      .pipe(map(r => r.codigosRecuperacion), tap(() => this.cargarSeguridad()));
  }

  desactivarDosFactores(): Observable<void> {
    return this.http.delete<void>(`${this.url}/dos-factores`).pipe(tap(() => this.cargarSeguridad()));
  }

  regenerarCodigos(): Observable<string[]> {
    return this.http.post<{ codigosRecuperacion: string[] }>(`${this.url}/dos-factores/codigos`, null)
      .pipe(map(r => r.codigosRecuperacion), tap(() => this.cargarSeguridad()));
  }

  sesiones(): Observable<SesionAbiertaPerfil[]> {
    return this.http.get<SesionAbiertaPerfil[]>(`${this.url}/sesiones`);
  }

  cerrarSesion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/sesiones/${encodeURIComponent(id)}`);
  }

  cerrarLasDemas(): Observable<number> {
    return this.http.delete<{ sesionesCerradas: number }>(`${this.url}/sesiones`).pipe(map(r => r.sesionesCerradas));
  }

  // ---------- cuenta y correo ----------

  /** Envía el enlace al correo nuevo; la cuenta no cambia de correo hasta que se abre. */
  cambiarCorreo(nuevo: string): Observable<string> {
    return this.http.post<{ pendiente: string }>(`${this.url}/correo`, { nuevo })
      .pipe(map(r => r.pendiente), tap(() => this.cargarSeguridad()));
  }

  cancelarCambioCorreo(): Observable<void> {
    return this.http.delete<void>(`${this.url}/correo`).pipe(tap(() => this.cargarSeguridad()));
  }

  // ---------- privacidad ----------

  /**
   * Descarga los datos de la cuenta como archivo JSON. Se piden como JSON normal (no como blob) para
   * que, si hace falta reautenticarse, el interceptor pueda leer la respuesta 403 y pedir el código.
   */
  descargarDatos(): Observable<void> {
    return this.http.get<unknown>(`${this.url}/mis-datos`).pipe(
      map(datos => guardarComoArchivo(JSON.stringify(datos, null, 2), nombreArchivoDatos(new Date())))
    );
  }

  /** Elimina (anonimiza) la cuenta. Después la sesión ya no vale. */
  eliminarCuenta(): Observable<void> {
    return this.http.delete<void>(this.url);
  }
}

/** «barhub-mis-datos-2026-11-23.json», con la fecha local. */
export function nombreArchivoDatos(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `barhub-mis-datos-${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}.json`;
}

function guardarComoArchivo(contenido: string, nombre: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después: algunos navegadores aún no han empezado la descarga al volver de click()
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
