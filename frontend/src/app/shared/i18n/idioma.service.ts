import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { IDIOMA_POR_DEFECTO, type Idioma, esIdioma, localeDe } from './idiomas';
import { type Clave, type Parametros, traducir, traducirSiExiste } from './textos';

const CLAVE = 'barhub.idioma';

/**
 * Idioma de las pantallas del cliente (español, portugués o inglés). La primera visita siempre en
 * español, esté el navegador en el idioma que esté; si el visitante elige otro en el menú, se recuerda
 * en este navegador. Todo se hace en el navegador: el servidor y los datos (nombres de productos,
 * mensajes de la API) no cambian.
 */
@Injectable({ providedIn: 'root' })
export class IdiomaService {
  private readonly documento = inject(DOCUMENT);
  private readonly actual = signal<Idioma>(idiomaInicial());

  /** El idioma actual, como señal: las plantillas que lo leen se actualizan al cambiarlo. */
  readonly idioma = this.actual.asReadonly();

  constructor() {
    this.ponerLangEnLaPagina(this.actual());
  }

  cambiar(idioma: Idioma): void {
    if (!esIdioma(idioma) || idioma === this.actual()) {
      return;
    }
    this.actual.set(idioma);
    guardar(idioma);
    this.ponerLangEnLaPagina(idioma);
  }

  t(clave: Clave, parametros?: Parametros): string {
    return traducir(this.actual(), clave, parametros);
  }

  /** Para claves que dependen de un dato de la API, p. ej. {@code 'estado.' + pedido.estado}. */
  tSiExiste(clave: string, porDefecto: string): string {
    return traducirSiExiste(this.actual(), clave, porDefecto);
  }

  /**
   * Mensaje que manda la API (siempre en español): se muestra tal cual en español y, en los otros
   * idiomas, se cambia por el texto de {@code clave}, que dice lo mismo sin los detalles.
   */
  delServidor(mensaje: string | null | undefined, clave: Clave, parametros?: Parametros): string {
    return this.actual() === 'es' && mensaje ? mensaje : this.t(clave, parametros);
  }

  /** Fecha con el formato del idioma elegido. */
  fecha(valor: string | number | Date, opciones: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(localeDe(this.actual()), opciones).format(new Date(valor));
  }

  /** Precio en euros con el formato del idioma: 12,50 € en español y portugués, €12.50 en inglés. */
  precio(valor: number | string | null | undefined): string {
    const numero = Number(valor ?? 0);
    return new Intl.NumberFormat(localeDe(this.actual()), { style: 'currency', currency: 'EUR' })
      .format(Number.isFinite(numero) ? numero : 0);
  }

  /** El atributo lang de la página: lo usan los lectores de pantalla para pronunciar bien. */
  private ponerLangEnLaPagina(idioma: Idioma): void {
    this.documento.documentElement.lang = idioma;
  }
}

function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (esIdioma(guardado)) {
      return guardado;
    }
  } catch {
    // Sin almacenamiento: español
  }
  return IDIOMA_POR_DEFECTO;
}

function guardar(idioma: Idioma): void {
  try {
    localStorage.setItem(CLAVE, idioma);
  } catch {
    // Sin almacenamiento: vale para esta visita
  }
}
