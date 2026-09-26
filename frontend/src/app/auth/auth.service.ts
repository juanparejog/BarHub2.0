import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt'; 
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private roles: string[] = [];
  private rolesSubject = new BehaviorSubject<string[]>(this.getRoles());
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.isAuthenticated());

  roles$ = this.rolesSubject.asObservable();
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private tokenKey = 'token';
  private jwtHelper = new JwtHelperService();

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: { username: string; password: string }): Observable<{ token: string }> {
    this.logout();
    return new Observable(observer => {
      this.http.post<{ token: string }>(`${this.apiUrl}/login`, credentials).subscribe({
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
            
            this.router.navigate(['/carta']);
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
    localStorage.clear();
    this.rolesSubject.next([]);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/']);
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