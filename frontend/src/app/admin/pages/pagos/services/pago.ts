import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Pago } from "../interface/pago";

@Injectable({ providedIn: 'root' })
export class PagoService {
  private URL_PAGOS = `${environment.urlBackendSpring}/pagos/`;

  constructor(private httpClient: HttpClient) { }

  get(): Observable<Pago[]> {
    return this.httpClient.get<Pago[]>(this.URL_PAGOS);
  }

  post(pago: Pago): Observable<Pago> {
    return this.httpClient.post<Pago>(this.URL_PAGOS, pago);
  }

  getId(id: string): Observable<Pago> {
    return this.httpClient.get<Pago>(`${this.URL_PAGOS}${id}`);
  }

  put(pago: Pago): Observable<Pago> {
    return this.httpClient.put<Pago>(`${this.URL_PAGOS}${pago.id}`, pago);
  }

  del(pago: Pago): Observable<string> {
    return this.httpClient.delete(`${this.URL_PAGOS}${pago.id}`, { responseType: 'text' });
  }  
}