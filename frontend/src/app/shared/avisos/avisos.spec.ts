import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AvisoService } from './aviso.service';
import { AvisosComponent } from './avisos.component';

/** Avisos: el dialogo de exito o error (con sus botones, Escape y el foco) y los avisos flotantes. */
describe('Avisos', () => {
  let avisos: AvisoService;

  function pintar() {
    const fixture = TestBed.createComponent(AvisosComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AvisosComponent] });
    avisos = TestBed.inject(AvisoService);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.classList.remove('con-dialogo');
  });

  it('sin botones indicados, el dialogo trae Aceptar como principal', () => {
    avisos.exito({ titulo: 'Cobro registrado' });
    expect(avisos.dialogo()?.tipo).toBe('exito');
    expect(avisos.dialogo()?.acciones).toEqual([{ texto: 'Aceptar', primaria: true }]);
  });

  it('pinta el dialogo accesible con su titulo, mensaje, detalles y botones, y pone el foco en el principal', async () => {
    const { fixture, raiz } = pintar();
    avisos.exito({
      titulo: '¡Pedido realizado con éxito!', mensaje: 'Ya está en el bar.',
      detalles: [{ etiqueta: 'Pedido', valor: 'BH-000007' }],
      acciones: [{ texto: 'Volver' }, { texto: 'Seguir mi pedido', primaria: true }]
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogo = raiz.querySelector('[role="dialog"]')!;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.querySelector('#aviso-titulo')?.textContent).toContain('¡Pedido realizado con éxito!');
    expect(dialogo.getAttribute('aria-describedby')).toBe('aviso-mensaje');
    expect(dialogo.querySelector('dd')?.textContent).toContain('BH-000007');
    expect(document.activeElement?.textContent).toContain('Seguir mi pedido');
    expect(document.body.classList.contains('con-dialogo')).toBe(true);
  });

  it('un boton cierra el dialogo y despues hace lo suyo; Escape cierra sin pulsar ninguno', () => {
    const { fixture, raiz } = pintar();
    const alPulsar = vi.fn();
    const alCerrar = vi.fn();
    avisos.exito({ titulo: 'Hecho', acciones: [{ texto: 'Ver', primaria: true, alPulsar }], alCerrar });
    fixture.detectChanges();
    raiz.querySelector<HTMLButtonElement>('.aviso-boton')!.click();
    fixture.detectChanges();
    expect(alPulsar).toHaveBeenCalledTimes(1);
    expect(alCerrar).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();

    avisos.error({ titulo: '¿Seguro?', alCerrar });
    fixture.detectChanges();
    raiz.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(avisos.dialogo()).toBeNull();
  });

  it('los avisos flotantes se van solos, como mucho tres a la vez', () => {
    vi.useFakeTimers();
    const { fixture, raiz } = pintar();
    avisos.flotante('Pedido #1: Listo');
    avisos.flotante('Pedido #2: Listo');
    avisos.flotante('Pedido #3: Listo');
    avisos.flotante('Mesa 4: Ocupada', 'info');
    fixture.detectChanges();
    const textos = Array.from(raiz.querySelectorAll('.aviso-flotante-texto')).map(e => e.textContent?.trim());
    expect(textos).toEqual(['Pedido #2: Listo', 'Pedido #3: Listo', 'Mesa 4: Ocupada']);
    expect(raiz.querySelector('.aviso-flotantes')?.getAttribute('aria-live')).toBe('polite');

    vi.advanceTimersByTime(AvisoService.DURACION_FLOTANTE);
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.aviso-flotante').length).toBe(0);
  });
});
