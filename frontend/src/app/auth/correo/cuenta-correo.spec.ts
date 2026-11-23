import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../auth.service';
import { ConfirmarCambioCorreoComponent } from './confirmar-cambio-correo.component';
import { ConfirmarCorreoComponent } from './confirmar-correo.component';
import { RecuperarComponent } from './recuperar.component';
import { RestablecerComponent } from './restablecer.component';
import { tokenDelFragmento } from './token-del-enlace';

const authService = {
  confirmarCorreo: vi.fn(),
  solicitarRecuperacion: vi.fn(),
  restablecerContrasena: vi.fn(),
  confirmarCambioCorreo: vi.fn(),
  isAuthenticated: vi.fn()
};
const replaceState = vi.fn();

function configurar(fragmento: string | null) {
  Object.values(authService).forEach(f => f.mockReset());
  replaceState.mockReset();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authService },
      { provide: ActivatedRoute, useValue: { snapshot: { fragment: fragmento } } },
      { provide: Location, useValue: { path: () => '/auth/pagina', replaceState } }
    ]
  });
}

function texto(raiz: HTMLElement): string {
  return raiz.textContent?.replace(/\s+/g, ' ') ?? '';
}

describe('tokenDelFragmento', () => {
  it('saca el token del fragmento del enlace', () => {
    expect(tokenDelFragmento('token=abc-123_X')).toBe('abc-123_X');
    expect(tokenDelFragmento('')).toBe('');
    expect(tokenDelFragmento(null)).toBe('');
  });
});

describe('ConfirmarCorreoComponent', () => {
  it('confirma con el token del enlace y lo quita de la barra de direcciones', () => {
    configurar('token=abc');
    authService.confirmarCorreo.mockReturnValue(of({ message: 'Correo confirmado. Ya puedes iniciar sesión.' }));
    const fixture = TestBed.createComponent(ConfirmarCorreoComponent);
    fixture.detectChanges();

    expect(authService.confirmarCorreo).toHaveBeenCalledWith('abc');
    expect(replaceState).toHaveBeenCalledWith('/auth/pagina');
    expect(texto(fixture.nativeElement)).toContain('Correo confirmado');
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe('/auth/login');
  });

  it('un enlace caducado muestra el motivo', () => {
    configurar('token=viejo');
    authService.confirmarCorreo.mockReturnValue(throwError(() => ({ error: { message: 'El enlace no es válido o ha caducado. Pide uno nuevo.' } })));
    const fixture = TestBed.createComponent(ConfirmarCorreoComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('ha caducado');
  });

  it('sin token ni siquiera llama al servidor', () => {
    configurar(null);
    const fixture = TestBed.createComponent(ConfirmarCorreoComponent);
    fixture.detectChanges();
    expect(authService.confirmarCorreo).not.toHaveBeenCalled();
    expect(texto(fixture.nativeElement)).toContain('incompleto');
  });

  it('si falla sin motivo da un aviso general', () => {
    configurar('token=abc');
    authService.confirmarCorreo.mockReturnValue(throwError(() => new Error('red')));
    const fixture = TestBed.createComponent(ConfirmarCorreoComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.mensaje).toContain('No se pudo confirmar');
  });
});

describe('RecuperarComponent', () => {
  it('con un correo no válido no envía nada', () => {
    configurar(null);
    const fixture = TestBed.createComponent(RecuperarComponent);
    fixture.componentInstance.form.setValue({ email: 'no-es-un-correo' });
    fixture.componentInstance.enviar();
    fixture.detectChanges();
    expect(authService.solicitarRecuperacion).not.toHaveBeenCalled();
    expect(texto(fixture.nativeElement)).toContain('Escribe un correo válido');
  });

  it('envía el correo y muestra la respuesta genérica', () => {
    configurar(null);
    authService.solicitarRecuperacion.mockReturnValue(of({ message: 'Si hay una cuenta con ese correo, te hemos enviado un enlace.' }));
    const fixture = TestBed.createComponent(RecuperarComponent);
    fixture.componentInstance.form.setValue({ email: 'ana@example.com' });
    fixture.componentInstance.enviar();
    fixture.detectChanges();
    expect(authService.solicitarRecuperacion).toHaveBeenCalledWith('ana@example.com');
    expect(texto(fixture.nativeElement)).toContain('Si hay una cuenta con ese correo');
  });

  it('si el servidor falla lo dice', () => {
    configurar(null);
    authService.solicitarRecuperacion.mockReturnValue(throwError(() => ({})));
    const fixture = TestBed.createComponent(RecuperarComponent);
    fixture.componentInstance.form.setValue({ email: 'ana@example.com' });
    fixture.componentInstance.enviar();
    expect(fixture.componentInstance.error).toContain('No se pudo enviar');
    expect(fixture.componentInstance.enviado).toBe(false);
  });
});

describe('RestablecerComponent', () => {
  function crear(fragmento: string | null = 'token=xyz') {
    configurar(fragmento);
    const fixture = TestBed.createComponent(RestablecerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('sin token avisa de que el enlace está incompleto', () => {
    const fixture = crear(null);
    expect(texto(fixture.nativeElement)).toContain('incompleto');
    expect(replaceState).toHaveBeenCalled();
  });

  it('exige una contraseña segura y que coincidan', () => {
    const fixture = crear();
    const c = fixture.componentInstance;
    c.form.setValue({ password: 'corta', repetir: 'corta' });
    c.cambiar();
    expect(authService.restablecerContrasena).not.toHaveBeenCalled();

    c.form.setValue({ password: 'NuevaClave99', repetir: 'OtraClave99' });
    c.cambiar();
    fixture.detectChanges();
    expect(c.noCoinciden).toBe(true);
    expect(authService.restablecerContrasena).not.toHaveBeenCalled();
    expect(texto(fixture.nativeElement)).toContain('no coinciden');
  });

  it('cambia la contraseña con el token del enlace', () => {
    const fixture = crear();
    authService.restablecerContrasena.mockReturnValue(of({ message: 'Contraseña cambiada. Ya puedes iniciar sesión.' }));
    fixture.componentInstance.form.setValue({ password: 'NuevaClave99', repetir: 'NuevaClave99' });
    fixture.componentInstance.cambiar();
    fixture.detectChanges();
    expect(authService.restablecerContrasena).toHaveBeenCalledWith('xyz', 'NuevaClave99');
    expect(texto(fixture.nativeElement)).toContain('se han cerrado todas tus sesiones');
  });

  it('un enlace ya usado muestra el motivo y ofrece pedir otro', () => {
    const fixture = crear();
    authService.restablecerContrasena.mockReturnValue(throwError(() => ({ error: { message: 'El enlace no es válido o ha caducado. Pide uno nuevo.' } })));
    fixture.componentInstance.form.setValue({ password: 'NuevaClave99', repetir: 'NuevaClave99' });
    fixture.componentInstance.cambiar();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('ha caducado');
    expect(fixture.componentInstance.cambiada).toBe(false);
  });

  it('si falla sin motivo da un aviso general', () => {
    const fixture = crear();
    authService.restablecerContrasena.mockReturnValue(throwError(() => new Error('red')));
    fixture.componentInstance.form.setValue({ password: 'NuevaClave99', repetir: 'NuevaClave99' });
    fixture.componentInstance.cambiar();
    expect(fixture.componentInstance.error).toContain('No se pudo cambiar');
  });
});

describe('ConfirmarCambioCorreoComponent', () => {
  it('confirma el correo nuevo, quita el token de la barra y, con sesión, lleva al perfil', () => {
    configurar('token=nuevo');
    authService.isAuthenticated.mockReturnValue(true);
    authService.confirmarCambioCorreo.mockReturnValue(of({ email: 'ana@nuevo.test', message: 'Listo: tu cuenta usa ahora ana@nuevo.test.' }));
    const fixture = TestBed.createComponent(ConfirmarCambioCorreoComponent);
    fixture.detectChanges();

    expect(authService.confirmarCambioCorreo).toHaveBeenCalledWith('nuevo');
    expect(replaceState).toHaveBeenCalledWith('/auth/pagina');
    expect(texto(fixture.nativeElement)).toContain('tu cuenta usa ahora ana@nuevo.test');
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe('/perfil/cuenta');
  });

  it('si otra cuenta ya usa ese correo muestra el motivo; sin sesión lleva al login', () => {
    configurar('token=nuevo');
    authService.confirmarCambioCorreo.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Ya hay una cuenta con ese correo.' } })));
    const fixture = TestBed.createComponent(ConfirmarCambioCorreoComponent);
    fixture.detectChanges();

    expect(texto(fixture.nativeElement)).toContain('Ya hay una cuenta con ese correo.');
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe('/auth/login');
  });

  it('sin token no llama al servidor', () => {
    configurar(null);
    const fixture = TestBed.createComponent(ConfirmarCambioCorreoComponent);
    fixture.detectChanges();

    expect(authService.confirmarCambioCorreo).not.toHaveBeenCalled();
    expect(texto(fixture.nativeElement)).toContain('El enlace está incompleto');
  });
});
