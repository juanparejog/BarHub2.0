import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Usuario } from '../../admin/pages/usuarios/interface/usuario';
import { AuthService } from '../../auth/auth.service';
import { DialogService } from '../../main/services/shared/services/dialog.service';
import { CodigoQrService } from '../../auth/dos-factores/codigo-qr.service';
import { PerfilDatosComponent } from './datos/perfil-datos.component';
import { PerfilDireccionComponent } from './direccion/perfil-direccion.component';
import { PerfilCuentaComponent } from './cuenta/perfil-cuenta.component';
import { PerfilComponent } from './perfil.component';
import { EstadoSeguridad, PerfilService, SesionAbiertaPerfil, nombreArchivoDatos } from './perfil.service';
import { PerfilPrivacidadComponent } from './privacidad/perfil-privacidad.component';
import { PerfilDosFactoresComponent } from './seguridad/perfil-dos-factores.component';
import { PerfilPasswordComponent } from './seguridad/perfil-password.component';
import { PerfilSesionesComponent } from './seguridad/perfil-sesiones.component';

const ANA: Usuario = {
  id: 5, username: 'ana', email: 'ana@barhub.test', password: '', roles: [{ id: 3, nombre: 'ROLE_CLIENTE' }],
  nombre: 'Ana', apellido1: 'López', apellido2: '', telefono: '600123456', calle: 'Calle Mayor 1',
  tipoVivienda: 'piso', portalNum: '1', pisoNum: '2', puerta: 'B', codigoPostal: '06001', instruccionesEntrega: ''
};
const SIN_2FA: EstadoSeguridad = {
  correoVerificado: true, dosFactoresActiva: false, dosFactoresObligatoria: false,
  codigosRecuperacionRestantes: 0, cuentaCreada: Date.UTC(2026, 0, 15), cambioCorreoPendiente: null
};
const CODIGOS = Array.from({ length: 10 }, (_, i) => `ABCD${i}-EFGH${i}`);

/** Doble de PerfilService con los mismos signals que el de verdad. */
function perfilFalso() {
  return {
    usuario: signal<Usuario | null>(ANA),
    seguridad: signal<EstadoSeguridad | null>(SIN_2FA),
    error: signal(''),
    cargar: vi.fn(),
    cargarSeguridad: vi.fn(),
    guardar: vi.fn(),
    cambiarPassword: vi.fn(),
    configurarDosFactores: vi.fn(),
    activarDosFactores: vi.fn(),
    desactivarDosFactores: vi.fn(),
    regenerarCodigos: vi.fn(),
    sesiones: vi.fn(),
    cerrarSesion: vi.fn(),
    cerrarLasDemas: vi.fn(),
    cambiarCorreo: vi.fn(),
    cancelarCambioCorreo: vi.fn(),
    descargarDatos: vi.fn(),
    eliminarCuenta: vi.fn()
  };
}

let perfil: ReturnType<typeof perfilFalso>;
const confirmar = vi.fn((_m: string, _t: string, accion: () => void) => accion());
const mostrarToast = vi.fn();
const logout = vi.fn();

/** Crea el componente con un PerfilService falso; {@code preparar} enseña al doble lo que debe devolver. */
function crear<T>(componente: new (...args: any[]) => T, preparar: () => void = () => undefined) {
  perfil = perfilFalso();
  confirmar.mockClear();
  mostrarToast.mockClear();
  logout.mockClear();
  preparar();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PerfilService, useValue: perfil },
      { provide: DialogService, useValue: { solicitarConfirmacion: confirmar, mostrarToast } },
      { provide: AuthService, useValue: { logout } },
      { provide: CodigoQrService, useValue: { comoImagen: () => Promise.resolve('data:image/png;base64,QR') } }
    ]
  });
  // La cabecera trae su propio PerfilService en providers: se sustituye también ahí
  TestBed.overrideComponent(PerfilComponent, { set: { providers: [{ provide: PerfilService, useValue: perfil }] } });
  const fixture = TestBed.createComponent(componente);
  fixture.detectChanges();
  // Los effect que rellenan los formularios con el perfil
  fixture.detectChanges();
  return { fixture, raiz: fixture.nativeElement as HTMLElement };
}

function escribir(raiz: HTMLElement, selector: string, valor: string): void {
  const campo = raiz.querySelector<HTMLInputElement>(selector)!;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  campo.dispatchEvent(new Event('blur'));
}

function boton(raiz: HTMLElement, texto: string): HTMLButtonElement {
  return Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.includes(texto))!;
}

const texto = (raiz: HTMLElement) => raiz.textContent?.replace(/\s+/g, ' ') ?? '';

describe('Perfil: cabecera y pestañas', () => {
  it('muestra el nombre, el rol, la fecha de alta, el estado de la cuenta y las cinco pestañas', () => {
    const { raiz } = crear(PerfilComponent);

    expect(raiz.querySelector('h1')?.textContent).toContain('Ana López');
    expect(texto(raiz)).toContain('@ana');
    expect(texto(raiz)).toContain('Cliente');
    expect(texto(raiz)).toContain('Miembro desde enero de 2026');
    expect(texto(raiz)).toContain('Correo verificado');
    expect(texto(raiz)).toContain('Verificación en dos pasos desactivada');
    const pestanas = Array.from(raiz.querySelectorAll('nav a')).map(a => a.getAttribute('href'));
    expect(pestanas).toEqual(['/datos', '/direccion', '/cuenta', '/seguridad', '/privacidad']);
    expect(perfil.cargar).toHaveBeenCalled();
  });
});

describe('Perfil: datos personales', () => {
  it('carga el nombre y guarda solo sus campos, sin espacios sobrantes', () => {
    const { fixture, raiz } = crear(PerfilDatosComponent);
    perfil.guardar.mockReturnValue(of(ANA));

    expect(raiz.querySelector<HTMLInputElement>('#nombre')?.value).toBe('Ana');
    expect(texto(raiz)).toContain('ana@barhub.test');
    escribir(raiz, '#nombre', '  Ana María ');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(perfil.guardar).toHaveBeenCalledWith({ nombre: 'Ana María', apellido1: 'López', apellido2: '' });
    expect(texto(raiz)).toContain('Datos guardados.');
  });

  it('sin nombre no guarda y lo marca', () => {
    const { fixture, raiz } = crear(PerfilDatosComponent);
    escribir(raiz, '#nombre', '');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(perfil.guardar).not.toHaveBeenCalled();
    expect(raiz.querySelector('#nombre')?.classList).toContain('is-invalid');
  });
});

describe('Perfil: dirección de entrega', () => {
  it('cambia los campos según el tipo de inmueble y guarda solo los del elegido', () => {
    const { fixture, raiz } = crear(PerfilDireccionComponent);
    perfil.guardar.mockReturnValue(of(ANA));
    expect(raiz.querySelector('#portalNum')).not.toBeNull();

    raiz.querySelector<HTMLInputElement>('input[value="casa"]')!.click();
    fixture.detectChanges();
    expect(raiz.querySelector('#portalNum')).toBeNull();
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(perfil.guardar).not.toHaveBeenCalled();

    escribir(raiz, '#casaNum', '7');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(perfil.guardar).toHaveBeenCalledWith(expect.objectContaining({
      tipoVivienda: 'casa', casaNum: '7', portalNum: '', pisoNum: '', puerta: '', calle: 'Calle Mayor 1'
    }));
  });

  it('un teléfono que no tiene 9 dígitos no se guarda', () => {
    const { fixture, raiz } = crear(PerfilDireccionComponent);
    escribir(raiz, '#telefono', '6001');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(perfil.guardar).not.toHaveBeenCalled();
    expect(raiz.querySelector('#telefono')?.classList).toContain('is-invalid');
  });
});

describe('Perfil: contraseña', () => {
  it('avisa si las nuevas no coinciden y no envía nada', () => {
    const { fixture, raiz } = crear(PerfilPasswordComponent);
    escribir(raiz, '#passwordActual', 'Vieja123');
    escribir(raiz, '#passwordNueva', 'Nueva123');
    escribir(raiz, '#passwordRepetida', 'Otra1234');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(perfil.cambiarPassword).not.toHaveBeenCalled();
    expect(raiz.querySelector('#passwordRepetida')?.classList).toContain('is-invalid');
  });

  it('cambiada, dice cuántas sesiones ha cerrado; con la actual mal, muestra el motivo', () => {
    const { fixture, raiz } = crear(PerfilPasswordComponent);
    perfil.cambiarPassword.mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'La contraseña actual no es correcta.' } })))
      .mockReturnValueOnce(of(2));
    const rellenar = () => {
      escribir(raiz, '#passwordActual', 'Vieja123');
      escribir(raiz, '#passwordNueva', 'Nueva123');
      escribir(raiz, '#passwordRepetida', 'Nueva123');
      raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };

    rellenar();
    expect(texto(raiz)).toContain('La contraseña actual no es correcta.');
    rellenar();
    expect(perfil.cambiarPassword).toHaveBeenLastCalledWith('Vieja123', 'Nueva123');
    expect(texto(raiz)).toContain('Hemos cerrado las otras 2 sesiones');
  });
});

describe('Perfil: verificación en dos pasos', () => {
  it('desactivada: la activa con el QR y el primer código, y enseña los códigos de recuperación', async () => {
    const { fixture, raiz } = crear(PerfilDosFactoresComponent);
    perfil.configurarDosFactores.mockReturnValue(of({ secreto: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/BarHub:ana' }));
    perfil.activarDosFactores.mockReturnValue(of(CODIGOS));

    boton(raiz, 'Activar la verificación').click();
    await new Promise(r => setTimeout(r, 0));
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid="secreto-totp"]')?.textContent?.trim()).toBe('JBSW Y3DP EHPK 3PXP');
    expect(raiz.querySelector('img.qr-perfil')?.getAttribute('src')).toBe('data:image/png;base64,QR');

    escribir(raiz, '#codigoActivar', '123456');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(perfil.activarDosFactores).toHaveBeenCalledWith('123456');
    expect(raiz.querySelectorAll('ul.codigos li')).toHaveLength(10);

    raiz.querySelector<HTMLInputElement>('#codigosGuardados')!.click();
    fixture.detectChanges();
    boton(raiz, 'Hecho').click();
    fixture.detectChanges();
    expect(raiz.querySelector('ul.codigos')).toBeNull();
  });

  it('activa y obligatoria (personal): puede generar códigos nuevos pero no desactivarla', () => {
    const { fixture, raiz } = crear(PerfilDosFactoresComponent);
    perfil.seguridad.set({ ...SIN_2FA, dosFactoresActiva: true, dosFactoresObligatoria: true, codigosRecuperacionRestantes: 3 });
    perfil.regenerarCodigos.mockReturnValue(of(CODIGOS));
    fixture.detectChanges();

    expect(texto(raiz)).toContain('Te quedan 3 códigos de recuperación');
    expect(boton(raiz, 'Desactivar')).toBeUndefined();
    boton(raiz, 'Generar códigos nuevos').click();
    fixture.detectChanges();
    expect(confirmar).toHaveBeenCalled();
    expect(raiz.querySelectorAll('ul.codigos li')).toHaveLength(10);
  });

  it('un cliente puede desactivarla tras confirmar', () => {
    const { fixture, raiz } = crear(PerfilDosFactoresComponent);
    perfil.seguridad.set({ ...SIN_2FA, dosFactoresActiva: true, codigosRecuperacionRestantes: 10 });
    perfil.desactivarDosFactores.mockReturnValue(of(undefined));
    fixture.detectChanges();

    boton(raiz, 'Desactivar').click();
    fixture.detectChanges();
    expect(perfil.desactivarDosFactores).toHaveBeenCalled();
    expect(texto(raiz)).toContain('Verificación en dos pasos desactivada.');
  });
});

describe('Perfil: sesiones abiertas', () => {
  const ahora = Date.now();
  const SESIONES: SesionAbiertaPerfil[] = [
    { id: 's1', creada: ahora - 3_600_000, ultimaActividad: ahora, ip: '203.0.113.5', actual: true,
      agente: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0' },
    { id: 's2', creada: ahora - 86_400_000, ultimaActividad: ahora - 7_200_000, ip: '198.51.100.7', actual: false,
      agente: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' }
  ];

  it('lista las sesiones, marca la de este navegador y cierra otra', () => {
    const { fixture, raiz } = crear(PerfilSesionesComponent, () => {
      perfil.sesiones.mockReturnValue(of(SESIONES));
      perfil.cerrarSesion.mockReturnValue(of(undefined));
    });

    expect(texto(raiz)).toContain('Firefox en Linux');
    expect(texto(raiz)).toContain('Este navegador');
    expect(texto(raiz)).toContain('Chrome en Android');
    expect(texto(raiz)).toContain('hace 2 horas');
    expect(raiz.querySelectorAll('li.sesion-item button')).toHaveLength(1);

    raiz.querySelector<HTMLButtonElement>('li.sesion-item button')!.click();
    fixture.detectChanges();
    expect(perfil.cerrarSesion).toHaveBeenCalledWith('s2');
    expect(perfil.sesiones).toHaveBeenCalledTimes(2);
  });

  it('«Cerrar todas las demás» deja solo esta', () => {
    const { fixture, raiz } = crear(PerfilSesionesComponent, () => {
      perfil.sesiones.mockReturnValueOnce(of(SESIONES)).mockReturnValueOnce(of([SESIONES[0]]));
      perfil.cerrarLasDemas.mockReturnValue(of(1));
    });

    boton(raiz, 'Cerrar todas las demás').click();
    fixture.detectChanges();
    expect(texto(raiz)).toContain('Hemos cerrado 1 sesión.');
    expect(raiz.querySelectorAll('li.sesion-item')).toHaveLength(1);
    expect(boton(raiz, 'Cerrar todas las demás')).toBeUndefined();
  });
});

describe('Perfil: cuenta y correo', () => {
  it('pide el cambio con el correo sin espacios y avisa de que falta abrir el enlace', () => {
    const { fixture, raiz } = crear(PerfilCuentaComponent);
    perfil.cambiarCorreo.mockReturnValue(of('ana@nuevo.test'));

    expect(raiz.querySelector('[data-testid="correo-actual"]')?.textContent).toContain('ana@barhub.test');
    expect(texto(raiz)).toContain('Verificado');
    escribir(raiz, '#correoNuevo', '  ana@nuevo.test ');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(perfil.cambiarCorreo).toHaveBeenCalledWith('ana@nuevo.test');
    expect(texto(raiz)).toContain('Te hemos enviado un enlace a ana@nuevo.test');
  });

  it('un correo no válido no se envía; uno ocupado muestra el motivo', () => {
    const { fixture, raiz } = crear(PerfilCuentaComponent);
    perfil.cambiarCorreo.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Ya hay una cuenta con ese correo.' } })));

    escribir(raiz, '#correoNuevo', 'no-es-un-correo');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(perfil.cambiarCorreo).not.toHaveBeenCalled();
    expect(raiz.querySelector('#correoNuevo')?.classList).toContain('is-invalid');

    escribir(raiz, '#correoNuevo', 'beto@barhub.test');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(texto(raiz)).toContain('Ya hay una cuenta con ese correo.');
  });

  it('con un cambio pendiente lo enseña y se puede cancelar', () => {
    const { fixture, raiz } = crear(PerfilCuentaComponent);
    perfil.seguridad.set({ ...SIN_2FA, cambioCorreoPendiente: 'ana@nuevo.test' });
    perfil.cancelarCambioCorreo.mockReturnValue(of(undefined));
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="cambio-pendiente"]')?.textContent).toContain('ana@nuevo.test');
    boton(raiz, 'Cancelar el cambio').click();
    fixture.detectChanges();
    expect(perfil.cancelarCambioCorreo).toHaveBeenCalled();
    expect(texto(raiz)).toContain('Cambio de correo cancelado');
  });
});

describe('Perfil: privacidad', () => {
  it('descarga los datos', () => {
    const { raiz } = crear(PerfilPrivacidadComponent);
    perfil.descargarDatos.mockReturnValue(of(undefined));

    boton(raiz, 'Descargar mis datos').click();
    expect(perfil.descargarDatos).toHaveBeenCalled();
  });

  it('un cliente elimina la cuenta tras escribir su usuario, y se cierra la sesión', () => {
    const { fixture, raiz } = crear(PerfilPrivacidadComponent);
    perfil.eliminarCuenta.mockReturnValue(of(undefined));
    const eliminar = () => boton(raiz, 'Eliminar mi cuenta');

    expect(eliminar().disabled).toBe(true);
    escribir(raiz, '#confirmarEliminar', 'otra');
    fixture.detectChanges();
    expect(eliminar().disabled).toBe(true);
    escribir(raiz, '#confirmarEliminar', 'ana');
    fixture.detectChanges();
    expect(eliminar().disabled).toBe(false);

    eliminar().click();
    fixture.detectChanges();
    expect(perfil.eliminarCuenta).toHaveBeenCalled();
    expect(mostrarToast).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });

  it('el personal no puede eliminar su cuenta desde aquí', () => {
    const { fixture, raiz } = crear(PerfilPrivacidadComponent);
    perfil.usuario.set({ ...ANA, roles: [{ id: 2, nombre: 'ROLE_EMPLEADO' }] });
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="eliminar-personal"]')).not.toBeNull();
    expect(raiz.querySelector('#confirmarEliminar')).toBeNull();
  });

  it('el archivo se llama con la fecha local', () => {
    expect(nombreArchivoDatos(new Date(2026, 10, 3))).toBe('barhub-mis-datos-2026-11-03.json');
  });
});
