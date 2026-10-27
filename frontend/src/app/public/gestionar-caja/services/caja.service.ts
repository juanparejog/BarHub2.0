import { environment } from "src/environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Caja, AperturaCajaDTO, CierreCajaDTO } from '../interface/caja';

@Injectable({
  providedIn: 'root'
})
export class CajaService {

  private readonly URL_CAJA = `${environment.urlBackendSpring}/caja`;

  constructor(private readonly http: HttpClient) { }

  obtenerCajaActual(): Observable<Caja> {
    return this.http.get<Caja>(`${this.URL_CAJA}/actual`);
  }

  abrirCaja(dto: AperturaCajaDTO): Observable<Caja> {
    return this.http.post<Caja>(`${this.URL_CAJA}/abrir`, dto);
  }

  cerrarCaja(dto: CierreCajaDTO): Observable<Caja> {
    return this.http.put<Caja>(`${this.URL_CAJA}/cerrar`, dto);
  }

  obtenerHistorial(): Observable<Caja[]> {
    return this.http.get<Caja[]>(`${this.URL_CAJA}/historial`);
  }
}