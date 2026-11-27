import { Injectable, inject, signal } from '@angular/core';
import { IdiomaService } from '../i18n/idioma.service';

export type TipoAviso = 'exito' | 'error' | 'info';

/** Un boton del dialogo. Al pulsarlo se cierra el dialogo y despues se ejecuta {@code alPulsar}. */
export interface AccionAviso {
  texto: string;
  primaria?: boolean;
  alPulsar?: () => void;
}

/** Una linea "etiqueta: valor" del dialogo (numero de pedido, total, cambio...). */
export interface DetalleAviso {
  etiqueta: string;
  valor: string;
}

export interface DialogoAviso {
  tipo: TipoAviso;
  titulo: string;
  mensaje?: string;
  detalles?: DetalleAviso[];
  acciones: AccionAviso[];
  /** Al cerrar sin pulsar ningun boton (Escape o clic fuera). */
  alCerrar?: () => void;
}

export interface AvisoFlotante {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

type OpcionesDialogo = Omit<DialogoAviso, 'tipo' | 'acciones'> & { acciones?: AccionAviso[] };

/**
 * Avisos de la aplicacion, en lugar de alert() y confirm():
 * <ul>
 *   <li>dialogo: modal con icono animado para lo que el usuario tiene que ver (pedido hecho, cobro
 *   registrado). Uno a la vez; el siguiente sustituye al anterior;</li>
 *   <li>flotante: aviso corto en una esquina que no bloquea la pantalla y se va solo (comanda servida,
 *   mesa cambiada). Para pantallas de trabajo, donde un modal pararia al personal.</li>
 * </ul>
 * Los pinta {@code AvisosComponent}, que esta una sola vez en la aplicacion.
 */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  static readonly DURACION_FLOTANTE = 3500;
  private static readonly MAXIMO_FLOTANTES = 3;

  private readonly idiomas = inject(IdiomaService);
  private siguienteId = 0;

  readonly dialogo = signal<DialogoAviso | null>(null);
  readonly flotantes = signal<AvisoFlotante[]>([]);

  exito(opciones: OpcionesDialogo): void {
    this.abrir('exito', opciones);
  }

  error(opciones: OpcionesDialogo): void {
    this.abrir('error', opciones);
  }

  /** Cierra el dialogo; con una accion, despues de cerrarlo ejecuta lo suyo. */
  cerrar(accion?: AccionAviso): void {
    const actual = this.dialogo();
    if (!actual) return;
    this.dialogo.set(null);
    if (accion) {
      accion.alPulsar?.();
    } else {
      actual.alCerrar?.();
    }
  }

  flotante(texto: string, tipo: TipoAviso = 'exito', duracion = AvisoService.DURACION_FLOTANTE): void {
    const id = ++this.siguienteId;
    this.flotantes.update(lista => [...lista.slice(-(AvisoService.MAXIMO_FLOTANTES - 1)), { id, tipo, texto }]);
    setTimeout(() => this.quitar(id), duracion);
  }

  quitar(id: number): void {
    this.flotantes.update(lista => lista.filter(f => f.id !== id));
  }

  private abrir(tipo: TipoAviso, opciones: OpcionesDialogo): void {
    const acciones = opciones.acciones?.length
      ? opciones.acciones
      : [{ texto: this.idiomas.t('dialogo.aceptar'), primaria: true }];
    this.dialogo.set({ ...opciones, tipo, acciones });
  }
}
