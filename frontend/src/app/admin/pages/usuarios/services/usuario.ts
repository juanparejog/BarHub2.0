import { Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";
import { catchError } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Usuario, Rol } from "../interface/usuario";

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private URL_USUARIOS = `${environment.urlBackendSpring}/usuarios`;

  constructor(private httpClient: HttpClient) { }

  // Añadir este método
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error desconocido';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      errorMessage = `Código: ${error.status}\nMensaje: ${error.message}`;
      if (error.error?.message) {
        errorMessage += `\nDetalles: ${error.error.message}`;
      }
    }
    console.error('[Error en UsuarioService]', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Métodos existentes con corrección de URLs y manejo de errores
  get(): Observable<Usuario[]> {
    return this.httpClient.get<Usuario[]>(this.URL_USUARIOS + '/')
      .pipe(catchError(this.handleError));
  }

  post(usuario: Usuario): Observable<Usuario> {
    return this.httpClient.post<Usuario>(this.URL_USUARIOS + "/", usuario)
      .pipe(catchError(this.handleError));
  }

  getId(id: number): Observable<Usuario> {
    return this.httpClient.get<Usuario>(`${this.URL_USUARIOS}/${id}`)
      .pipe(catchError(this.handleError));
  }

  put(usuario: Usuario): Observable<Usuario> {
    return this.httpClient.put<Usuario>(
      `${this.URL_USUARIOS}/${usuario.id}`, 
      usuario
    ).pipe(catchError(this.handleError));
  }

  del(id: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.URL_USUARIOS}/${id}`)
      .pipe(catchError(this.handleError));
  }  

  actualizarRoles(usuarioId: number, roles: Rol[]): Observable<Rol[]> {
    return this.httpClient.put<Rol[]>(
      `${this.URL_USUARIOS}/${usuarioId}/roles`,
      roles.map(r => r.id)
    ).pipe(catchError(this.handleError));
  }
}
