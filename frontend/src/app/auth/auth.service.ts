import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt'; 
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

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

  login(credentials: { username: string; password: string }): Observable<{ token: string }> {
    // Sin navegar: si las credenciales fallan, el aviso tiene que verse en el mismo formulario
    this.limpiarSesion();
    return new Observable(observer => {
      // withCredentials: el backend entrega la cookie HttpOnly de renovacion
      this.http.post<{ token: string }>(`${this.apiUrl}/login`, credentials, { withCredentials: true }).subscribe({
        next: (res) => {
          if (!res.token) {
            observer.error('El servidor no devolvió un token');
            return;
          }
  
          localStorage.setItem(this.tokenKey, res.token);
          
          try {
            const decodedToken = this.jwtHelper.decodeToken(res.token);
            const roles = decodedToken.roles || []; // 👈 Extrae roles del token
            
            // Guarda roles en localStorage
            localStorage.setItem('roles', JSON.stringify(roles));
            
            localStorage.setItem('user', JSON.stringify({
              id: decodedToken.id,
              username: decodedToken.sub
            }));
            
            // Actualiza los subjects
            this.rolesSubject.next(roles);
            this.isAuthenticatedSubject.next(true);
            
            void this.router.navigate(['/carta']);
            observer.next(res);
          } catch (error) {
            localStorage.removeItem(this.tokenKey);
            observer.error('Token inválido: ' + error);
          }
          observer.complete();
        },
        error: (err) => observer.error(err)
      });
    });
  }  

  register(data: { username: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  logout(): void {
    // Cierra la sesion en el servidor: dejan de valer la cookie de renovacion y el token de acceso
    this.http.post(`${this.apiUrl}/logout`, null, { withCredentials: true }).subscribe({ error: () => undefined });
    this.limpiarSesion();
    void this.router.navigate(['/']);
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
}