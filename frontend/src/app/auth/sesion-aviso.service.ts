import { Injectable, NgZone, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  CLAVE_CONTACTO, CLAVE_INTERACCION, RespuestaSesion, guardarLimitesSesion, leerLimites
} from './sesion-limites';

/** El aviso de inactividad aparece 2 minutos antes del cierre. */
export const AVISO_INACTIVIDAD_MS = 2 * 60_000;
/** El aviso de final de sesion aparece 5 minutos antes de la duracion maxima. */
export const AVISO_FIN_MS = 5 * 60_000;

const EVENTOS_INTERACCION = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
const INTERVALO_MS = 1000;
/** La interaccion se apunta como mucho cada 10 segundos. */
const GUARDADO_INTERACCION_MS = 10_000;

export type EstadoAviso = 'ninguno' | 'inactividad' | 'fin-proximo';

function cuentaAtras(ms: number): string {
  const segundos = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

function hora(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Avisa antes de que la sesion se cierre:
 * - por inactividad: "¿Sigues ahi?" con cuenta atras; si nadie responde, cierra la sesion;
 * - por la duracion maxima del rol: avisa de la hora de cierre, que no se puede alargar.
 *
 * La inactividad se mide por la interaccion del usuario (no por las peticiones automaticas de las
 * pantallas que se refrescan solas) y se comparte entre pestanas. Si el usuario esta activo pero
 * la pagina no hace peticiones, se renueva en segundo plano para que el servidor no cierre la sesion.
 */
@Injectable({ providedIn: 'root' })
export class SesionAvisoService {
  private readonly zone = inject(NgZone);
  private readonly authService = inject(AuthService);
  // Sin interceptores: la renovacion de aqui no debe disparar otra renovacion
  private readonly http = new HttpClient(inject(HttpBackend));

  readonly estado = signal<EstadoAviso>('ninguno');
  /** Cuenta atras del aviso de inactividad (m:ss) o la hora de cierre del aviso de final. */
  readonly texto = signal('');

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private ultimoGuardado = 0;
  private renovando = false;
  /** caducaEn de la sesion cuyo aviso de final ya se ha cerrado. */
  private finDescartado = 0;

  iniciar(): void {
    if (this.temporizador) {
      return;
    }
    // Fuera de Angular: el temporizador no provoca deteccion de cambios cada segundo
    this.zone.runOutsideAngular(() => {
      EVENTOS_INTERACCION.forEach(evento =>
        document.addEventListener(evento, this.alInteractuar, { passive: true, capture: true }));
      this.temporizador = setInterval(() => this.comprobar(), INTERVALO_MS);
    });
  }

  detener(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
    EVENTOS_INTERACCION.forEach(evento =>
      document.removeEventListener(evento, this.alInteractuar, { capture: true }));
  }

  comprobar(ahora = Date.now()): void {
    const limites = leerLimites();
    if (!limites || !localStorage.getItem('token')) {
      this.cambiar('ninguno');
      return;
    }
    const interaccion = Number(localStorage.getItem(CLAVE_INTERACCION)) || ahora;
    const finInactividad = interaccion + limites.inactividadMs;

    if (ahora >= Math.min(finInactividad, limites.caducaEn)) {
      this.caducar();
    } else if (finInactividad <= limites.caducaEn && finInactividad - ahora <= AVISO_INACTIVIDAD_MS) {
      this.cambiar('inactividad', cuentaAtras(finInactividad - ahora));
    } else if (limites.caducaEn - ahora <= AVISO_FIN_MS && this.finDescartado !== limites.caducaEn) {
      this.cambiar('fin-proximo', hora(limites.caducaEn));
    } else {
      this.cambiar('ninguno');
    }
  }

  seguirConectado(): void {
    localStorage.setItem(CLAVE_INTERACCION, String(Date.now()));
    this.cambiar('ninguno');
    this.renovar();
  }

  descartarAvisoDeFin(): void {
    this.finDescartado = leerLimites()?.caducaEn ?? 0;
    this.cambiar('ninguno');
  }

  cerrarSesion(): void {
    this.cambiar('ninguno');
    this.authService.logout();
  }

  private readonly alInteractuar = (): void => {
    // Con el aviso de inactividad abierto solo cuenta el boton "Seguir conectado"
    if (this.estado() === 'inactividad') {
      return;
    }
    const ahora = Date.now();
    if (ahora - this.ultimoGuardado < GUARDADO_INTERACCION_MS || !localStorage.getItem('token')) {
      return;
    }
    this.ultimoGuardado = ahora;
    localStorage.setItem(CLAVE_INTERACCION, String(ahora));

    const limites = leerLimites();
    const contacto = Number(localStorage.getItem(CLAVE_CONTACTO)) || 0;
    if (limites && ahora - contacto >= limites.inactividadMs / 2) {
      this.renovar();
    }
  };

  private renovar(): void {
    if (this.renovando) {
      return;
    }
    this.renovando = true;
    this.http.post<RespuestaSesion>(`${environment.urlBackendSpring}/auth/refresh`, null, { withCredentials: true })
      .subscribe({
        next: respuesta => {
          localStorage.setItem('token', respuesta.token);
          guardarLimitesSesion(respuesta, false);
          this.renovando = false;
        },
        // Si no se puede renovar, la siguiente peticion o el propio temporizador cierran la sesion
        error: () => (this.renovando = false)
      });
  }

  private caducar(): void {
    this.cambiar('ninguno');
    this.zone.run(() => this.authService.logout('caducada'));
  }

  private cambiar(estado: EstadoAviso, texto = ''): void {
    if (this.estado() === estado && this.texto() === texto) {
      return;
    }
    this.zone.run(() => {
      this.estado.set(estado);
      this.texto.set(texto);
    });
  }
}
