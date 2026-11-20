import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: false
})
export class HomeComponent {
  /** Los botones de inicio de sesion y registro solo se muestran sin sesion. */
  readonly isAuthenticated$: Observable<boolean>;

  constructor(authService: AuthService) {
    this.isAuthenticated$ = authService.isAuthenticated$;
  }
}
