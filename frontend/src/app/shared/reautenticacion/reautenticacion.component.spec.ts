import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MetodoReautenticacion, ReautenticacionService } from '../../auth/reautenticacion.service';
import { ReautenticacionComponent } from './reautenticacion.component';

describe('ReautenticacionComponent', () => {
  const solicitud = signal<MetodoReautenticacion | null>(null);
  const servicio = { solicitud, confirmar: vi.fn(), cancelar: vi.fn() };

  function crear() {
    servicio.confirmar.mockReset();
    servicio.cancelar.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ReautenticacionService, useValue: servicio }] });
    const fixture = TestBed.createComponent(ReautenticacionComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  function escribirYConfirmar(raiz: HTMLElement, valor: string): void {
    raiz.querySelector<HTMLInputElement>('#campoReautenticacion')!.value = valor;
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  afterEach(() => solicitud.set(null));

  it('no pinta nada mientras no se pide', () => {
    const { raiz } = crear();
    expect(raiz.querySelector('dialog')).toBeNull();
  });

  it('pide el código de la app y lo envía', () => {
    const { fixture, raiz } = crear();
    servicio.confirmar.mockReturnValue(of(undefined));
    solicitud.set('codigo');
    fixture.detectChanges();

    expect(raiz.querySelector('dialog')?.textContent).toContain('código de 6 dígitos');
    expect(raiz.querySelector('#campoReautenticacion')?.getAttribute('autocomplete')).toBe('one-time-code');
    escribirYConfirmar(raiz, ' 123456 ');
    expect(servicio.confirmar).toHaveBeenCalledWith('123456');
  });

  it('sin 2FA pide la contraseña en un campo oculto', () => {
    const { fixture, raiz } = crear();
    solicitud.set('password');
    fixture.detectChanges();

    expect(raiz.querySelector('#campoReautenticacion')?.getAttribute('type')).toBe('password');
  });

  it('un código incorrecto muestra el motivo y deja la ventana abierta', () => {
    const { fixture, raiz } = crear();
    servicio.confirmar.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'Código incorrecto.' } })));
    solicitud.set('codigo');
    fixture.detectChanges();

    escribirYConfirmar(raiz, '000000');
    fixture.detectChanges();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Código incorrecto.');
    expect(raiz.querySelector('dialog')).not.toBeNull();
  });

  it('Cancelar la cierra sin confirmar', () => {
    const { fixture, raiz } = crear();
    solicitud.set('codigo');
    fixture.detectChanges();

    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cancelar')!.click();
    expect(servicio.cancelar).toHaveBeenCalled();
    expect(servicio.confirmar).not.toHaveBeenCalled();
  });
});
