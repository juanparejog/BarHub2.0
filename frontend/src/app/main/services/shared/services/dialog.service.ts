import { Injectable } from '@angular/core';

/**
 * Diálogos y avisos con la API nativa de Bootstrap 5 (sin jQuery).
 * Bootstrap se carga como script global desde angular.json (bootstrap.bundle).
 */
@Injectable({
  providedIn: 'root'
})
export class DialogService {

  private readonly HTML_MODAL_ALERT = `
    <div class="modal fade" id="modalAlert" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="modalAlertTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
              <div class="modal-header">
                  <h5 class="modal-title" id="modalAlertTitulo">Advertencia</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body"></div>
              <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Aceptar</button>
              </div>
          </div>
      </div>
    </div>
  `;

  private readonly HTML_MODAL_CONFIRMAR = `
    <div class="modal fade" id="modalConfirmar" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="modalConfirmarTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="modalConfirmarTitulo">Advertencia</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button id="botonAceptar" type="button" class="btn btn-danger">Aceptar</button>
            </div>
        </div>
      </div>
    </div>
  `;

  private readonly HTML_TOAST = `
    <div aria-live="polite" aria-atomic="true" class="d-flex justify-content-center align-items-center w-100">
      <div id="__Toast" class="toast align-items-center" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body"></div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
        </div>
      </div>
    </div>
  `;

  /**
   * Muestra un mensaje en un modal con un botón de aceptar.
   */
  mostrarMensaje(mensaje: string, titulo: string = 'Advertencia'): void {
    const modal = this.obtenerElemento('modalAlert', this.HTML_MODAL_ALERT);
    this.ponerTexto(modal, '.modal-title', titulo);
    this.ponerTexto(modal, '.modal-body', mensaje);
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }

  /**
   * Pide confirmación y ejecuta la acción solo si el usuario pulsa Aceptar.
   */
  solicitarConfirmacion(mensaje: string, titulo: string, accion: () => void): void {
    const modal = this.obtenerElemento('modalConfirmar', this.HTML_MODAL_CONFIRMAR);
    this.ponerTexto(modal, '.modal-title', titulo);
    this.ponerTexto(modal, '.modal-body', mensaje);

    const instancia = bootstrap.Modal.getOrCreateInstance(modal);
    const botonAceptar = modal.querySelector<HTMLButtonElement>('#botonAceptar');
    if (botonAceptar) {
      // onclick sustituye al manejador anterior: si antes se pulsó Cancelar,
      // la acción de aquella confirmación no se queda enganchada
      botonAceptar.onclick = (evento: MouseEvent) => {
        evento.stopPropagation();
        botonAceptar.onclick = null;
        instancia.hide();
        accion();
      };
    }
    instancia.show();
  }

  /**
   * Muestra un mensaje breve en formato toast.
   */
  mostrarToast(mensaje: string): void {
    const toast = this.obtenerElemento('__Toast', this.HTML_TOAST);
    this.ponerTexto(toast, '.toast-body', mensaje);
    bootstrap.Toast.getOrCreateInstance(toast).show();
  }

  /** Devuelve el elemento por id; si no existe, inserta su HTML (constante) al final del body. */
  private obtenerElemento(id: string, html: string): HTMLElement {
    let elemento = document.getElementById(id);
    if (!elemento) {
      document.body.insertAdjacentHTML('beforeend', html);
      elemento = document.getElementById(id) as HTMLElement;
    }
    return elemento;
  }

  /** textContent, como el .text() de jQuery: el mensaje nunca se interpreta como HTML. */
  private ponerTexto(contenedor: HTMLElement, selector: string, texto: string): void {
    const destino = contenedor.querySelector(selector);
    if (destino) {
      destino.textContent = texto;
    }
  }
}
