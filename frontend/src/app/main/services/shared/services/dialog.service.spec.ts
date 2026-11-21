import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DialogService } from './dialog.service';

/** Bootstrap se carga como script global en la app; en los tests se simula su API. */
const instancia = { show: vi.fn(), hide: vi.fn() };
(globalThis as unknown as { bootstrap: unknown }).bootstrap = {
  Modal: { getOrCreateInstance: () => instancia },
  Toast: { getOrCreateInstance: () => instancia }
};

describe('DialogService', () => {
  let servicio: DialogService;

  beforeEach(() => {
    document.body.innerHTML = '';
    instancia.show.mockClear();
    instancia.hide.mockClear();
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(DialogService);
  });

  it('mostrarToast muestra el texto sin interpretarlo como HTML', () => {
    servicio.mostrarToast('<img src=x onerror=alert(1)>Guardado');
    const cuerpo = document.querySelector('#__Toast .toast-body');
    expect(cuerpo?.textContent).toBe('<img src=x onerror=alert(1)>Guardado');
    expect(cuerpo?.querySelector('img')).toBeNull();
    expect(instancia.show).toHaveBeenCalledTimes(1);
  });

  it('reutiliza el mismo toast en lugar de crear uno nuevo cada vez', () => {
    servicio.mostrarToast('uno');
    servicio.mostrarToast('dos');
    expect(document.querySelectorAll('#__Toast')).toHaveLength(1);
    expect(document.querySelector('#__Toast .toast-body')?.textContent).toBe('dos');
  });

  it('mostrarMensaje pone título y mensaje en el modal', () => {
    servicio.mostrarMensaje('No hay caja abierta', 'Caja');
    expect(document.querySelector('#modalAlert .modal-title')?.textContent).toBe('Caja');
    expect(document.querySelector('#modalAlert .modal-body')?.textContent).toBe('No hay caja abierta');
    expect(instancia.show).toHaveBeenCalledTimes(1);
  });

  it('una confirmación cancelada no se ejecuta al aceptar la siguiente', () => {
    const primera = vi.fn();
    const segunda = vi.fn();

    servicio.solicitarConfirmacion('¿Borrar la mesa 1?', 'Confirmar', primera);
    // El usuario cancela: no pulsa Aceptar
    servicio.solicitarConfirmacion('¿Borrar la mesa 2?', 'Confirmar', segunda);
    (document.querySelector('#botonAceptar') as HTMLButtonElement).click();

    expect(primera).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
    expect(instancia.hide).toHaveBeenCalledTimes(1);
  });
});
