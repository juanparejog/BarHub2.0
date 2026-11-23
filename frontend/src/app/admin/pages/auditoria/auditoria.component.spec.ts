import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuditoriaComponent } from './auditoria.component';
import { AuditoriaService, EventoAuditoria, PaginaAuditoria } from './auditoria.service';

describe('AuditoriaComponent', () => {
  const buscar = vi.fn();

  const evento = (cambios: Partial<EventoAuditoria>): EventoAuditoria => ({
    fecha: Date.parse('2026-11-23T10:15:30Z'), usuario: 'ana', accion: 'INICIO_SESION', resultado: 'CORRECTO',
    ip: '203.0.113.5', objetivo: null, detalle: null, peticion: 'POST /auth/login', ...cambios
  });
  const pagina = (eventos: EventoAuditoria[], numero = 0, paginas = 1, total = eventos.length): PaginaAuditoria =>
    ({ eventos, total, pagina: numero, paginas });

  function crear() {
    TestBed.configureTestingModule({
      imports: [AuditoriaComponent],
      providers: [{ provide: AuditoriaService, useValue: { buscar } }]
    });
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  const texto = (elemento: Element | null) => elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const boton = (raiz: HTMLElement, contenido: string) =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.includes(contenido))!;

  beforeEach(() => buscar.mockReset());

  it('al abrir pide los últimos 7 días, primera página y sin más filtros', () => {
    buscar.mockReturnValue(of(pagina([])));
    crear();
    const filtro = buscar.mock.calls[0][0];
    expect((Date.parse(filtro.hasta) - Date.parse(filtro.desde)) / 86_400_000).toBe(6);
    expect(filtro).toMatchObject({ usuario: '', accion: '', resultado: '', pagina: 0 });
  });

  it('pinta cada entrada con el nombre de la acción, el resultado, la IP y el detalle', () => {
    buscar.mockReturnValue(of(pagina([
      evento({ resultado: 'RECHAZADO', usuario: 'nadie', ip: '198.51.100.7' }),
      evento({ accion: 'USUARIO_EDITADO', usuario: 'admin', objetivo: 'usuario 12 (ana)', detalle: 'roles: CLIENTE -> EMPLEADO',
        peticion: 'PUT /usuarios/12' })
    ])));
    const { raiz } = crear();

    const filas = Array.from(raiz.querySelectorAll('tbody tr'));
    expect(filas.length).toBe(2);
    expect(texto(filas[0])).toContain('Inicio de sesión');
    expect(filas[0].querySelector('.badge')?.className).toContain('text-bg-warning');
    expect(texto(filas[0])).toContain('Rechazado');
    expect(texto(filas[0])).toContain('198.51.100.7');
    expect(texto(filas[1])).toContain('Usuario editado');
    expect(texto(filas[1])).toContain('usuario 12 (ana)');
    expect(texto(filas[1])).toContain('roles: CLIENTE -> EMPLEADO');
    expect(texto(raiz.querySelector('[role="status"]'))).toBe('2 entradas');
  });

  it('al buscar con filtros vuelve a la primera página', () => {
    buscar.mockReturnValue(of(pagina([evento({})], 2, 5, 230)));
    const { fixture, raiz } = crear();
    fixture.componentInstance.filtro.usuario = 'ana';
    fixture.componentInstance.filtro.accion = 'ACCESO_DENEGADO';

    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(buscar).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: 'ana', accion: 'ACCESO_DENEGADO', pagina: 0 }));
  });

  it('pasa de página y desactiva «Anterior» en la primera y «Siguiente» en la última', () => {
    buscar.mockReturnValueOnce(of(pagina([evento({})], 0, 2, 60))).mockReturnValueOnce(of(pagina([evento({})], 1, 2, 60)));
    const { fixture, raiz } = crear();
    expect(texto(raiz.querySelector('nav'))).toContain('Página 1 de 2');
    expect(boton(raiz, 'Anterior').disabled).toBe(true);

    boton(raiz, 'Siguiente').click();
    fixture.detectChanges();
    expect(buscar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1 }));
    expect(texto(raiz.querySelector('nav'))).toContain('Página 2 de 2');
    expect(boton(raiz, 'Siguiente').disabled).toBe(true);
  });

  it('sin entradas lo dice, y si falla muestra el motivo', () => {
    buscar.mockReturnValueOnce(of(pagina([])))
      .mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: "'desde' no puede ser posterior a 'hasta'." } })));
    const { fixture, raiz } = crear();
    expect(texto(raiz.querySelector('tbody'))).toContain('No hay entradas con estos filtros.');

    fixture.componentInstance.buscar();
    fixture.detectChanges();
    expect(texto(raiz.querySelector('[role="alert"]'))).toContain("'desde' no puede ser posterior a 'hasta'.");
  });
});
