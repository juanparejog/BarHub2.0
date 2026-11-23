import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, map, take, tap } from 'rxjs';
import { environment } from '../../environments/environment';

/** Con que se confirma: el codigo de la app si tiene la verificacion en dos pasos; si no, la contrasena. */
export type MetodoReautenticacion = 'codigo' | 'password';

/**
 * Antes de una accion critica (alta, edicion o borrado de usuarios...), el backend responde
 * 403 REAUTENTICACION_REQUERIDA si hace mas de unos minutos que el administrador no confirma quien es.
 * El interceptor llama a {@link pedir}: la ventana de ReautenticacionComponent pide el codigo y,
 * si se confirma, la peticion original se repite sola. Varias peticiones a la vez comparten una
 * sola ventana.
 */
@Injectable({ providedIn: 'root' })
export class ReautenticacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.urlBackendSpring}/auth/reautenticar`;

  /** Metodo que hay que pedir mientras la ventana esta abierta; null si esta cerrada. */
  readonly solicitud = signal<MetodoReautenticacion | null>(null);
  private resultado: Subject<boolean> | null = null;

  /** Abre la ventana; emite true si el usuario confirma y false si cancela. */
  pedir(metodo: MetodoReautenticacion): Observable<boolean> {
    if (!this.resultado) {
      this.resultado = new Subject<boolean>();
      this.solicitud.set(metodo);
    }
    return this.resultado.pipe(take(1));
  }

  /** Envia el codigo (o la contrasena). Si es correcto cierra la ventana y deja seguir a quien esperaba. */
  confirmar(valor: string): Observable<void> {
    const cuerpo = this.solicitud() === 'password' ? { password: valor } : { codigo: valor };
    return this.http.post<{ reautenticadaHasta: number }>(this.url, cuerpo).pipe(
      tap(() => this.terminar(true)),
      map(() => undefined)
    );
  }

  cancelar(): void {
    this.terminar(false);
  }

  private terminar(confirmada: boolean): void {
    const resultado = this.resultado;
    this.resultado = null;
    this.solicitud.set(null);
    resultado?.next(confirmada);
    resultado?.complete();
  }
}
