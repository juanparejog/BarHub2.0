import { Injectable, Injector, inject } from '@angular/core';
import {
  HttpBackend, HttpClient, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { CLAVE_CONTACTO, CLAVE_INTERACCION, CLAVE_LIMITES, RespuestaSesion, guardarLimitesSesion } from './sesion-limites';
import { MetodoReautenticacion, ReautenticacionService } from './reautenticacion.service';

// Todo lo que se guarda al iniciar sesion: si la sesion caduca se borra entero
const CLAVES_SESION = ['token', 'roles', 'user', 'username', 'usuarioId', 'id', 'imagen',
  CLAVE_LIMITES, CLAVE_INTERACCION, CLAVE_CONTACTO];

// En estas rutas un 401 no es un token caducado: login con credenciales malas, codigo del segundo
// paso incorrecto, renovacion fallida...
const RUTAS_SIN_RENOVACION = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout',
  '/auth/2fa/verificar', '/auth/2fa/configurar', '/auth/2fa/activar'];

/**
 * Unico interceptor HTTP de la aplicacion:
 * - anade el token de acceso a cada peticion;
 * - si el backend responde 401 porque el token de acceso (15 minutos) ha caducado, lo renueva con la
 *   cookie HttpOnly de renovacion y repite la peticion, sin que el usuario lo note;
 * - si la renovacion tambien falla (sesion cerrada, inactividad o duracion maxima), borra la sesion
 *   local y lleva al login con el aviso de sesion caducada.
 * Varias peticiones que caducan a la vez comparten una sola renovacion.
 * - si una accion critica responde 403 REAUTENTICACION_REQUERIDA, pide el codigo de la app (o la
 *   contrasena) con ReautenticacionService y, si se confirma, repite la peticion.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private renovacion$: Observable<string> | null = null;
  // Cliente HTTP sin interceptores, para que la renovacion no vuelva a pasar por aqui
  private readonly httpSinInterceptores: HttpClient;

  // Se pide al usarlo: el servicio usa HttpClient, que a su vez usa este interceptor
  private readonly injector = inject(Injector);

  constructor(private readonly router: Router, httpBackend: HttpBackend) {
    this.httpSinInterceptores = new HttpClient(httpBackend);
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return this.conRenovacion(req, next).pipe(
      catchError((error: HttpErrorResponse) => {
        const metodo = this.metodoReautenticacion(error);
        if (!metodo) {
          return throwError(() => error);
        }
        return this.injector.get(ReautenticacionService).pedir(metodo).pipe(
          switchMap(confirmada => confirmada ? this.conRenovacion(req, next) : throwError(() => error))
        );
      })
    );
  }

  /** La peticion con el token; si caduca, la renueva y la repite. */
  private conRenovacion(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(this.conToken(req)).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401 || this.esRutaSinRenovacion(req.url)) {
          return throwError(() => error);
        }
        if (!localStorage.getItem('token')) {
          // Sin sesion iniciada no hay nada que renovar: al login, sin aviso de caducidad
          this.irAlLogin(false);
          return throwError(() => error);
        }
        return this.renovar().pipe(
          catchError(() => {
            this.irAlLogin(true);
            return throwError(() => error);
          }),
          switchMap(() => next.handle(this.conToken(req)))
        );
      })
    );
  }

  private metodoReautenticacion(error: HttpErrorResponse): MetodoReautenticacion | null {
    if (error.status !== 403 || error.error?.code !== 'REAUTENTICACION_REQUERIDA') {
      return null;
    }
    return error.error.metodo === 'password' ? 'password' : 'codigo';
  }

  private conToken(req: HttpRequest<any>): HttpRequest<any> {
    const token = localStorage.getItem('token');
    return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  }

  private esRutaSinRenovacion(url: string): boolean {
    return RUTAS_SIN_RENOVACION.some(ruta => url.endsWith(ruta));
  }

  private renovar(): Observable<string> {
    // Una sola renovación a la vez: las peticiones que caducan mientras tanto esperan a la misma
    this.renovacion$ ??= this.httpSinInterceptores
      .post<RespuestaSesion>(`${environment.urlBackendSpring}/auth/refresh`, null, { withCredentials: true })
      .pipe(
        map(respuesta => {
          localStorage.setItem('token', respuesta.token);
          guardarLimitesSesion(respuesta, false);
          return respuesta.token;
        }),
        finalize(() => (this.renovacion$ = null)),
        shareReplay(1)
      );
    return this.renovacion$;
  }

  private irAlLogin(sesionCaducada: boolean): void {
    CLAVES_SESION.forEach(clave => localStorage.removeItem(clave));
    if (sesionCaducada) {
      void this.router.navigate(['/auth/login'], { queryParams: { sesion: 'caducada' } });
    } else {
      void this.router.navigate(['/auth/login']);
    }
  }
}
