import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Producto } from "../interface/producto";

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private URL_PRODUCTOS = `${environment.urlBackendSpring}/productos/`;

  constructor(
    private httpClient: HttpClient
  ) { }

  //----------------------------------------------------------
  // Funciones para realizar peticiones al backend
  //----------------------------------------------------------

  /**
   * Obtiene todos los productos
   * @returns devuelve un observable con la lista de productos
   */
  get(): Observable<Producto[]> {
    return this.httpClient.get<Producto[]>(this.URL_PRODUCTOS);
  }

  /**
   * Recibe un producto y la añade
   * @param producto que se va a añadir
   * @returns un observable con la producto añadido
   */
  post(producto: Producto): Observable<Producto> {
    return this.httpClient.post<Producto>(this.URL_PRODUCTOS, producto);
  }

  /**
   * Se busca un producto con el id que se pasa por parámetros
   * @param id del producto que va a buscar
   * @returns un observable con los productos
   */
   getId(id: string): Observable<Producto> {
    return this.httpClient.get<Producto>(`${this.URL_PRODUCTOS}${id}`);
  }

  /**
   * Se realiza una petición para actualizar un producto
   * @param producto producto actualizado
   * @returns un observable con el producto actualizada
   */
  put(producto: Producto): Observable<Producto> {
    const url = `${this.URL_PRODUCTOS}${producto.id}`;
    return this.httpClient.put<Producto>(url, producto);
  }

  /**
   * Se realiza una petición para eliminar un producto
   * @param producto producto que se va a eliminar
   * @returns un observable con el producto eliminado
   */
  del(producto: Producto): Observable<Producto> {
    const url = `${this.URL_PRODUCTOS}${producto.id}`;
    return this.httpClient.delete<Producto>(url);
  }
}