import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EstadoAviso, SesionAvisoService } from '../../auth/sesion-aviso.service';
import { AvisoSesionComponent } from './aviso-sesion.component';

describe('AvisoSesionComponent', () => {
  const estado = signal<EstadoAviso>('ninguno');
  const texto = signal('');
  const aviso = {
    estado, texto,
    iniciar: vi.fn(), detener: vi.fn(),
    seguirConectado: vi.fn(), cerrarSesion: vi.fn(), descartarAvisoDeFin: vi.fn()
  };

  function crear() {
    TestBed.configureTestingModule({
      imports: [AvisoSesionComponent],
      providers: [{ provide: SesionAvisoService, useValue: aviso }]
    });
    const fixture = TestBed.createComponent(AvisoSesionComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    estado.set('ninguno');
    texto.set('');
    Object.values(aviso).forEach(v => typeof v === 'function' && 'mockClear' in v && v.mockClear());
  });

  it('arranca la vigilancia al crearse y la para al destruirse', () => {
    const fixture = crear();
    expect(aviso.iniciar).toHaveBeenCalled();
    fixture.destroy();
    expect(aviso.detener).toHaveBeenCalled();
  });

  it('sin aviso no pinta nada', () => {
    const fixture = crear();
    expect((fixture.nativeElement as HTMLElement).children.length).toBe(0);
  });

  it('el aviso de inactividad muestra la cuenta atrás, recibe el foco y sus botones responden', async () => {
    const fixture = crear();
    estado.set('inactividad');
    texto.set('1:30');
    fixture.detectChanges();
    await fixture.whenStable();

    const raiz = fixture.nativeElement as HTMLElement;
    const dialogo = raiz.querySelector('[role="alertdialog"]');
    expect(dialogo?.textContent).toContain('¿Sigues ahí?');
    expect(raiz.querySelector('.cuenta-atras')?.textContent).toBe('1:30');

    const [cerrar, seguir] = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.modal-footer button'));
    expect(document.activeElement).toBe(seguir);
    seguir.click();
    expect(aviso.seguirConectado).toHaveBeenCalled();
    cerrar.click();
    expect(aviso.cerrarSesion).toHaveBeenCalled();
  });

  it('el aviso de final muestra la hora y se puede cerrar', () => {
    const fixture = crear();
    estado.set('fin-proximo');
    texto.set('18:45');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('18:45');
    raiz.querySelector<HTMLButtonElement>('.btn-close')!.click();
    expect(aviso.descartarAvisoDeFin).toHaveBeenCalled();
  });
});
