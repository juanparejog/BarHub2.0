import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredRoles = route.data['roles'] as string[];
    
    if (!requiredRoles) {
      return true;
    }

    const userRoles = this.authService.getRoles();
    const hasAccess = requiredRoles.some(role => userRoles.includes(role));

    if (hasAccess) {
      return true;
    } else {
      this.router.navigate(['/']);
      alert('No tienes permisos para acceder a esta página');
      return false;
    }
  }
}
