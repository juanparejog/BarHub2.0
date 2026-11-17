import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

// Todo lo que se guarda al iniciar sesion: si el token caduca se borra entero
const CLAVES_SESION = ['token', 'roles', 'username', 'usuarioId', 'id', 'imagen'];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private readonly router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token');

    let authReq = req;
    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          CLAVES_SESION.forEach(k => localStorage.removeItem(k));
          void this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}