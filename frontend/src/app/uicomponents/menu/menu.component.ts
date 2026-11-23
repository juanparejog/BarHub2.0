import { IMAGEN_USUARIO_POR_DEFECTO, ponerImagenPorDefecto } from '../../shared/imagen-por-defecto';
import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { ThemeService } from 'src/app/services/theme.service';
import { TurnoService } from 'src/app/services/turno.service';

@Component({
    selector: 'app-menu',
    templateUrl: './menu.component.html',
    styleUrls: ['./menu.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MenuComponent implements OnInit {
  roles$ = this.authService.roles$;
  isDarkMode$!: Observable<boolean>;
  private readonly turnoService = inject(TurnoService);
  
  constructor(
    public authService: AuthService,
    private readonly themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.isDarkMode$ = this.themeService.isDarkMode$;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  get sesionIniciada(): boolean {
    return this.authService.isAuthenticated();
  }

  get nombreUsuario(): string {
    return this.authService.getNombreUsuario();
  }

  get imagenUsuario(): string {
    const imagenGuardada = localStorage.getItem('imagen');
    if (imagenGuardada) {
      return imagenGuardada;
    }
    const username = localStorage.getItem('username');
    if (username) {
      return `assets/images/usuarios/${username}.jpg`;
    }
    return 'assets/images/usuarios/default.jpg';
  }

  cerrarSesion() {
    localStorage.removeItem('imagen');
    localStorage.removeItem('usuarioId');
    localStorage.removeItem('roles');
    localStorage.removeItem('username');
    localStorage.removeItem('token');

    this.authService.logout();
  }

  get esEmpleado(): boolean {
    return this.authService.hasRole(['ROLE_EMPLEADO']);
  }

  /** Registra la salida del turno (con confirmacion) y cierra la sesion. */
  terminarTurno(): void {
    this.turnoService.pedirFinDeTurno();
  }

  get isAdmin(): boolean {
    return this.authService.hasRole(['ROLE_ADMIN']);
  }

  get isEmple(): boolean {
    return this.authService.hasRole(['ROLE_EMPLEADO', 'ROLE_ADMIN']);
  }

  get isCliente(): boolean {
    return this.authService.hasRole(['ROLE_CLIENTE', 'ROLE_EMPLEADO', 'ROLE_ADMIN']);
  }

  onImageError(event: Event): void {
    ponerImagenPorDefecto(event, IMAGEN_USUARIO_POR_DEFECTO);
  }
}