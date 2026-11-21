import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { RoleGuard } from './role.guard';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let rolesDelUsuario: string[];
  const navigate = vi.fn(() => Promise.resolve(true));

  const ruta = (rolesRequeridos?: string[]) =>
    ({ data: rolesRequeridos ? { roles: rolesRequeridos } : {} }) as unknown as ActivatedRouteSnapshot;

  beforeEach(() => {
    rolesDelUsuario = [];
    navigate.mockClear();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { getRoles: () => rolesDelUsuario } },
        { provide: Router, useValue: { navigate } }
      ]
    });
    guard = TestBed.inject(RoleGuard);
  });

  afterEach(() => vi.restoreAllMocks());

  it('deja pasar si la ruta no exige roles', () => {
    expect(guard.canActivate(ruta())).toBe(true);
  });

  it('deja pasar al administrador al panel de administración', () => {
    rolesDelUsuario = ['ROLE_ADMIN'];
    expect(guard.canActivate(ruta(['ROLE_ADMIN']))).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('deja pasar al empleado a las rutas de empleado', () => {
    rolesDelUsuario = ['ROLE_EMPLEADO'];
    expect(guard.canActivate(ruta(['ROLE_EMPLEADO', 'ROLE_ADMIN']))).toBe(true);
  });

  it('impide al cliente entrar en la administración y lo manda al inicio', () => {
    rolesDelUsuario = ['ROLE_CLIENTE'];
    expect(guard.canActivate(ruta(['ROLE_ADMIN']))).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(window.alert).toHaveBeenCalledTimes(1);
  });

  it('impide al empleado entrar en la administración', () => {
    rolesDelUsuario = ['ROLE_EMPLEADO'];
    expect(guard.canActivate(ruta(['ROLE_ADMIN']))).toBe(false);
  });

  it('impide el acceso a quien no tiene sesión', () => {
    expect(guard.canActivate(ruta(['ROLE_EMPLEADO', 'ROLE_ADMIN']))).toBe(false);
  });
});
