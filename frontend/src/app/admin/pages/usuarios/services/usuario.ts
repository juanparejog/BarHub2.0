import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Usuario, Rol } from "../interface/usuario";

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private readonly URL_USUARIOS = `${environment.urlBackendSpring}/usuarios/`;

  constructor(
    private readonly httpClient: HttpClient
  ) { }

  get(): Observable<Usuario[]> {
    return this.httpClient.get<Usuario[]>(this.URL_USUARIOS);
  }

  getId(id: string | number): Observable<Usuario> {
    return this.httpClient.get<Usuario>(`${this.URL_USUARIOS}${id}`);
  }

  post(usuario: Usuario, file?: File | null): Observable<Usuario> {
    const formData = this.crearFormData(usuario, file);
    return this.httpClient.post<Usuario>(this.URL_USUARIOS, formData);
  }

  put(usuario: Usuario, file?: File | null): Observable<Usuario> {
    const url = `${this.URL_USUARIOS}${usuario.id}`;
    const formData = this.crearFormData(usuario, file);
    return this.httpClient.put<Usuario>(url, formData);
  }

  del(usuarioOrId: Usuario | number): Observable<any> {
    const id = typeof usuarioOrId === 'object' ? usuarioOrId.id : usuarioOrId;
    const url = `${this.URL_USUARIOS}${id}`;
    return this.httpClient.delete<any>(url);
  }

  actualizarRoles(usuarioId: number, roles: Rol[]): Observable<Rol[]> {
    return this.httpClient.put<Rol[]>(
      `${this.URL_USUARIOS}${usuarioId}/roles`,
      roles.map(r => r.id)
    );
  }

  private crearFormData(usuario: Usuario, file?: File | null): FormData {
    const formData = new FormData();

    formData.append(
      'usuario',
      new Blob([JSON.stringify(usuario)], { type: 'application/json' })
    );

    if (file) {
      formData.append('file', file);
    }

    return formData;
  }
}