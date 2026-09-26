import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Mesa } from "../interface/mesa";

@Injectable({
  providedIn: 'root'
})
export class MesaService {

  private URL_MESAS = `${environment.urlBackendSpring}/mesas/`;

  constructor(
    private httpClient: HttpClient
  ) { }

  //----------------------------------------------------------
  // Funciones para realizar peticiones al backend
  //----------------------------------------------------------

  /**
   * Obtiene todas las mesas
   * @returns devuelve un observable con la lista de mesas
   */
  get(): Observable<Mesa[]> {
    return this.httpClient.get<Mesa[]>(this.URL_MESAS);
  }

  /**
   * Recibe una mesa y la añade
   * @param mesa que se va a añadir
   * @returns un observable con la mesa añadida
   */
  post(mesa: Mesa): Observable<Mesa> {
    return this.httpClient.post<Mesa>(this.URL_MESAS, mesa);
  }

  /**
   * Se busca una mesa con el id que se pasa por parámetros
   * @param id de la mesas que va a buscar
   * @returns un observable con la mesas
   */
   getId(id: string): Observable<Mesa> {
    return this.httpClient.get<Mesa>(`${this.URL_MESAS}${id}`);
  }

  /**
   * Se realiza una petición para actualizar una mesa
   * @param mesa mesa actualizada
   * @returns un observable con la mesa actualizada
   */
  put(mesa: Mesa): Observable<Mesa> {
    const url = `${this.URL_MESAS}${mesa.id}`;
    return this.httpClient.put<Mesa>(url, mesa);
  }

  /**
   * Se realiza una petición para eliminar una mesa
   * @param mesa mesa que se va a eliminar
   * @returns un observable con la mesa eliminada
   */
  del(mesa: Mesa): Observable<Mesa> {
    const url = `${this.URL_MESAS}${mesa.id}`;
    return this.httpClient.delete<Mesa>(url);
  }
}