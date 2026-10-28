import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  roles$ = this.authService.roles$;
  isDarkMode$!: Observable<boolean>;
  
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

  get isAdmin(): boolean {
    return this.authService.hasRole(['ROLE_ADMIN']);
  }

  get isEmple(): boolean {
    return this.authService.hasRole(['ROLE_EMPLEADO', 'ROLE_ADMIN']);
  }

  get isCliente(): boolean {
    return this.authService.hasRole(['ROLE_CLIENTE', 'ROLE_EMPLEADO', 'ROLE_ADMIN']);
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/usuarios/default.jpg';
  }
}