import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt'; 
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { RespuestaSesion, guardarLimitesSesion } from './sesion-limites';

/** Login con la contrasena correcta al que le falta el segundo paso (configurar: aun no tiene la app). */
export interface DesafioDosFactores {
  requiere2fa: true;
  configurar: boolean;
  desafio: string;
  caducaEnSegundos: number;
}

/** Sesion abierta; los codigos solo llegan al activar el 2FA o al entrar con uno de recuperacion. */
export interface SesionAbierta extends RespuestaSesion {
  id?: number;
  username?: string;
  roles?: string[];
  codigosRecuperacion?: string[] | null;
  codigosRecuperacionRestantes?: number | null;
}

export type RespuestaLogin = SesionAbierta | DesafioDosFactores;

export interface ConfiguracionDosFactores {
  secreto: string;
  uri: string;
}

export function esDesafio(res: RespuestaLogin): res is DesafioDosFactores {
  return (res as DesafioDosFactores).requiere2fa === true;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.urlBackendSpring}/auth`;
  private roles: string[] = [];
  private readonly rolesSubject = new BehaviorSubject<string[]>(this.getRoles());
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(this.isAuthenticated());

  roles$ = this.rolesSubject.asObservable();
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private readonly tokenKey = 'token';
  private readonly jwtHelper = new JwtHelperService();

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  /**
   * Primer paso del login. Si la cuenta usa (o su rol exige) la verificacion en dos pasos, devuelve
   * el desafio para /auth/2fa y la sesion no se abre todavia; si no, abre la sesion.
   * No navega: si las credenciales fallan, el aviso tiene que verse en el mismo formulario.
   */
  login(credentials: { username: string; password: string }): Observable<RespuestaLogin> {
    this.limpiarSesion();
    // withCredentials: el backend entrega la cookie HttpOnly de renovacion
    return this.http.post<RespuestaLogin>(`${this.apiUrl}/login`, credentials, { withCredentials: true }).pipe(
      map(res => {
        if (!esDesafio(res)) {
          this.abrirSesion(res);
        }
        return res;
      })
    );
  }

  /** Segundo paso con el codigo de la app o un codigo de recuperacion. */
  verificarDosFactores(desafio: string, codigo: string): Observable<SesionAbierta> {
    return this.http.post<SesionAbierta>(`${this.apiUrl}/2fa/verificar`, { desafio, codigo }, { withCredentials: true })
      .pipe(tap(res => this.abrirSesion(res)));
  }

  /** Secreto nuevo para dar de alta la cuenta en la app (clave y URI otpauth:// para el QR). */
  configurarDosFactores(desafio: string): Observable<ConfiguracionDosFactores> {
    return this.http.post<ConfiguracionDosFactores>(`${this.apiUrl}/2fa/configurar`, { desafio });
  }

  /** Activa la verificacion con el primer codigo de la app; abre la sesion y trae los codigos de recuperacion. */
  activarDosFactores(desafio: string, codigo: string): Observable<SesionAbierta> {
    return this.http.post<SesionAbierta>(`${this.apiUrl}/2fa/activar`, { desafio, codigo }, { withCredentials: true })
      .pipe(tap(res => this.abrirSesion(res)));
  }

  /** Guarda el token, los limites de la sesion y los datos del usuario que leen el menu y los guards. */
  private abrirSesion(res: RespuestaSesion & { id?: number }): void {
    if (!res.token) {
      throw new Error('El servidor no devolvió un token');
    }
    const token = this.jwtHelper.decodeToken(res.token);
    if (!token) {
      throw new Error('Token inválido');
    }
    const roles: string[] = token.roles || [];
    const id = token.id ?? res.id;

    localStorage.setItem(this.tokenKey, res.token);
    guardarLimitesSesion(res, true);
    localStorage.setItem('roles', JSON.stringify(roles));
    localStorage.setItem('user', JSON.stringify({ id, username: token.sub }));
    localStorage.setItem('username', token.username || token.sub);
    if (id) {
      localStorage.setItem('usuarioId', String(id));
    }

    this.rolesSubject.next(roles);
    this.isAuthenticatedSubject.next(true);
  }

  register(data: { username: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  /** Con motivo 'caducada' lleva al login con el aviso de sesion caducada; si no, a la portada. */
  logout(motivo?: 'caducada'): void {
    // Cierra la sesion en el servidor: dejan de valer la cookie de renovacion y el token de acceso
    this.http.post(`${this.apiUrl}/logout`, null, { withCredentials: true }).subscribe({ error: () => undefined });
    this.limpiarSesion();
    if (motivo === 'caducada') {
      void this.router.navigate(['/auth/login'], { queryParams: { sesion: 'caducada' } });
    } else {
      void this.router.navigate(['/']);
    }
  }

  private limpiarSesion(): void {
    localStorage.clear();
    this.rolesSubject.next([]);
    this.isAuthenticatedSubject.next(false);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/verify?token=${token}`);
  }

  setRoles(roles: string[]) {
    this.roles = roles;
  }

  getRoles(): string[] {
    const roles = localStorage.getItem('roles');
    return roles ? JSON.parse(roles) : [];
  }
  
  hasRole(requiredRoles: string[]): boolean {
    const userRoles = this.getRoles();
    return requiredRoles.some(role => userRoles.includes(role));
  }
  
  
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }  

  isLoggedIn(): boolean {
    return localStorage.getItem('user') !== null;
  }

  getCurrentUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getNombreUsuario(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.nombre || user.username || '';
  }

  /** Confirma la cuenta con el token del enlace del correo. */
  confirmarCorreo(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/verificar`, { token });
  }

  /** Vuelve a enviar el correo de confirmacion (por nombre de usuario o email). */
  reenviarConfirmacion(usuario: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reenviar-verificacion`, { usuario });
  }

  /** "He olvidado mi contrasena": envia el enlace si hay una cuenta con ese correo. */
  solicitarRecuperacion(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/recuperar`, { email });
  }

  /** Nueva contrasena con el token del enlace del correo. */
  restablecerContrasena(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/restablecer`, { token, password });
  }
}
