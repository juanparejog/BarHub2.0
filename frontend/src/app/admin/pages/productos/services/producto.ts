import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Producto } from "../interface/producto";

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private readonly URL_PRODUCTOS = `${environment.urlBackendSpring}/productos/`;

  constructor(
    private readonly httpClient: HttpClient
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
   * Se busca un producto con el id que se pasa por parámetros
   * @param id del producto que va a buscar
   * @returns un observable con el producto
   */
  getId(id: string | number): Observable<Producto> {
    return this.httpClient.get<Producto>(`${this.URL_PRODUCTOS}${id}`);
  }

  /**
   * Recibe un producto y opcionalmente un archivo de imagen para crearlo
   * @param producto datos del producto a añadir
   * @param file archivo de imagen (opcional)
   * @returns un observable con el producto añadido
   */
  post(producto: Producto, file?: File | null): Observable<Producto> {
    const formData = this.crearFormData(producto, file);
    return this.httpClient.post<Producto>(this.URL_PRODUCTOS, formData);
  }

  /**
   * Se realiza una petición para actualizar un producto y opcionalmente su imagen
   * @param producto producto actualizado
   * @param file nuevo archivo de imagen (opcional)
   * @returns un observable con el producto actualizado
   */
  put(producto: Producto, file?: File | null): Observable<Producto> {
    const url = `${this.URL_PRODUCTOS}${producto.id}`;
    const formData = this.crearFormData(producto, file);
    return this.httpClient.put<Producto>(url, formData);
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

  //----------------------------------------------------------
  // Métodos auxiliares
  //----------------------------------------------------------

  /**
   * Empaqueta el objeto Producto (como JSON) y la imagen en un objeto FormData
   */
  private crearFormData(producto: Producto, file?: File | null): FormData {
    const formData = new FormData();

    formData.append(
      'producto',
      new Blob([JSON.stringify(producto)], { type: 'application/json' })
    );

    if (file) {
      formData.append('file', file);
    }

    return formData;
  }
}