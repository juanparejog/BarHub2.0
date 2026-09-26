import { Component } from '@angular/core';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent {
  roles$ = this.authService.roles$;
  
  constructor(public authService: AuthService) {}

  get sesionIniciada(): boolean {
    return this.authService.isAuthenticated();
  }

  get nombreUsuario(): string {
    return this.authService.getNombreUsuario();
  }

  cerrarSesion() {
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
}