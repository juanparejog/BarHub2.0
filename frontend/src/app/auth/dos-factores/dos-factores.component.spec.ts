import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../auth.service';
import { CodigoQrService } from './codigo-qr.service';
import { DosFactoresComponent } from './dos-factores.component';

const authService = {
  isAuthenticated: vi.fn(),
  verificarDosFactores: vi.fn(),
  configurarDosFactores: vi.fn(),
  activarDosFactores: vi.fn()
};
const codigoQr = { comoImagen: vi.fn() };
const CODIGOS = ['ABCDE-FGHJK', 'MNPQR-STUVW', 'XYZ23-45678', 'A2B3C-D4E5F', 'G6H7J-K8M9N',
  'PQRST-UVWXY', 'Z2345-6789A', 'BCDEF-GHJKM', 'NPQRS-TUVWX', 'YZ234-56789'];

/** Crea la pantalla como si el login hubiera dejado {@code estado} en el historial. */
function crear(estado: object | null, preparar: () => void = () => undefined) {
  Object.values(authService).forEach(f => f.mockReset());
  codigoQr.comoImagen.mockReset();
  preparar();
  history.replaceState(estado, '');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authService },
      { provide: CodigoQrService, useValue: codigoQr }
    ]
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(DosFactoresComponent);
  fixture.detectChanges();
  return { fixture, raiz: fixture.nativeElement as HTMLElement, navegar };
}

const CONFIGURAR = { desafio: 'd2', configurar: true, usuario: 'ana' };

/** Deja que terminen las promesas pendientes (el QR se dibuja de forma asincrona). */
const promesas = () => new Promise(resolve => setTimeout(resolve, 0));

function texto(raiz: HTMLElement): string {
  return raiz.textContent?.replace(/\s+/g, ' ') ?? '';
}

function escribirYEnviar(raiz: HTMLElement, valor: string): void {
  const campo = raiz.querySelector<HTMLInputElement>('#codigo2fa')!;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
}

describe('DosFactoresComponent', () => {
  afterEach(() => history.replaceState(null, ''));

  it('sin desafio (recarga o enlace directo) manda a iniciar sesion', () => {
    const { raiz } = crear(null);

    expect(texto(raiz)).toContain('Empieza de nuevo desde el inicio de sesión.');
    expect(raiz.querySelector('a')?.getAttribute('href')).toBe('/auth/login');
  });

  it('si ya ha entrado (recarga tras activar), sigue a la carta', () => {
    const { navegar } = crear(null, () => authService.isAuthenticated.mockReturnValue(true));

    expect(navegar).toHaveBeenCalledWith(['/carta']);
  });

  it('con el codigo de la app correcto entra en la carta', () => {
    const { fixture, raiz, navegar } = crear({ desafio: 'd1', configurar: false, usuario: 'ana' });
    authService.verificarDosFactores.mockReturnValue(of({ token: 't' }));

    expect(texto(raiz)).toContain('código de 6 dígitos');
    escribirYEnviar(raiz, ' 123456 ');
    fixture.detectChanges();

    expect(authService.verificarDosFactores).toHaveBeenCalledWith('d1', '123456');
    expect(navegar).toHaveBeenCalledWith(['/carta']);
  });

  it('un codigo incorrecto muestra el aviso y deja volver a intentarlo', () => {
    const { fixture, raiz, navegar } = crear({ desafio: 'd1' });
    authService.verificarDosFactores.mockReturnValue(throwError(() => ({
      status: 401, error: { code: 'CODIGO_INCORRECTO', message: 'Código incorrecto.' }
    })));

    escribirYEnviar(raiz, '000000');
    fixture.detectChanges();

    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Código incorrecto.');
    expect(raiz.querySelector('#codigo2fa')).not.toBeNull();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si el desafio caduca o se bloquea la cuenta, vuelve al login', () => {
    const { fixture, raiz } = crear({ desafio: 'd1' });
    authService.verificarDosFactores.mockReturnValue(throwError(() => ({
      status: 429, error: { message: 'Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.' }
    })));

    escribirYEnviar(raiz, '000000');
    fixture.detectChanges();

    expect(texto(raiz)).toContain('Vuelve a intentarlo en 15 minutos.');
    expect(raiz.querySelector('#codigo2fa')).toBeNull();
  });

  it('con un codigo de recuperacion avisa de cuantos quedan', () => {
    const { fixture, raiz, navegar } = crear({ desafio: 'd1' });
    authService.verificarDosFactores.mockReturnValue(of({ token: 't', codigosRecuperacionRestantes: 9 }));

    const enlace = Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.includes('código de recuperación'))!;
    enlace.click();
    fixture.detectChanges();
    expect(raiz.querySelector('#codigo2fa')?.getAttribute('placeholder')).toBe('XXXXX-XXXXX');

    escribirYEnviar(raiz, 'abcde-fghjk');
    fixture.detectChanges();

    expect(authService.verificarDosFactores).toHaveBeenCalledWith('d1', 'abcde-fghjk');
    expect(texto(raiz)).toContain('Te quedan 9 códigos de recuperación');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('el personal sin la app configurada ve el QR y la clave, la activa y recibe los codigos', async () => {
    const { fixture, raiz, navegar } = crear(CONFIGURAR, () => {
      authService.configurarDosFactores.mockReturnValue(of({ secreto: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/BarHub:ana?secret=JBSWY3DPEHPK3PXP' }));
      codigoQr.comoImagen.mockResolvedValue('data:image/png;base64,QR');
    });

    expect(authService.configurarDosFactores).toHaveBeenCalledWith('d2');
    expect(raiz.querySelector('[data-testid="secreto-totp"]')?.textContent?.trim()).toBe('JBSW Y3DP EHPK 3PXP');
    await promesas();
    fixture.detectChanges();
    expect(codigoQr.comoImagen).toHaveBeenCalledWith('otpauth://totp/BarHub:ana?secret=JBSWY3DPEHPK3PXP');
    expect(raiz.querySelector<HTMLImageElement>('img.qr')?.getAttribute('src')).toBe('data:image/png;base64,QR');

    authService.activarDosFactores.mockReturnValue(of({ token: 't', codigosRecuperacion: CODIGOS }));
    escribirYEnviar(raiz, '654321');
    fixture.detectChanges();

    expect(authService.activarDosFactores).toHaveBeenCalledWith('d2', '654321');
    expect(raiz.querySelectorAll('ul.codigos li')).toHaveLength(10);
    expect(texto(raiz)).toContain('ABCDE-FGHJK');
    const continuar = Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Continuar')!;
    expect(continuar.disabled).toBe(true);

    raiz.querySelector<HTMLInputElement>('#codigosGuardados')!.click();
    fixture.detectChanges();
    expect(continuar.disabled).toBe(false);
    continuar.click();
    expect(navegar).toHaveBeenCalledWith(['/carta']);
  });

  it('si el QR no se puede dibujar, la clave escrita sigue a la vista', async () => {
    const { fixture, raiz } = crear(CONFIGURAR, () => {
      authService.configurarDosFactores.mockReturnValue(of({ secreto: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://x' }));
      codigoQr.comoImagen.mockRejectedValue(new Error('sin libreria'));
    });

    await promesas();
    fixture.detectChanges();
    expect(raiz.querySelector('img.qr')).toBeNull();
    expect(raiz.querySelector('[data-testid="secreto-totp"]')?.textContent).toContain('JBSW');
  });
});
