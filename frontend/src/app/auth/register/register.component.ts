import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  form = {
    username: '',
    email: '',
    password: '',
    nombre: '',
    apellido1: '',
    apellido2: '',
    telefono: '',
    calle: '',
    tipoVivienda: 'casa',
    codigoPostal: '',
    role: ['ROLE_CLIENTE']
  };
  aceptaPoliticas = false;
  confirmPassword = '';
  usernameTaken = false;
  usernameRestricted = false;
  showPassword = false;
  showConfirmPassword = false;
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  onSubmit(): void {
    this.usernameTaken = false;
    this.usernameRestricted = false;

    // Validación estricta para impedir el username 'default' (sin importar mayúsculas/minúsculas)
    if (this.form.username.trim().toLowerCase() === 'default') {
      this.usernameRestricted = true;
      this.showToastMessage('El nombre de usuario "default" está reservado y no se puede utilizar.');
      return;
    }
  
    if (this.form.password !== this.confirmPassword) {
      this.showToastMessage('Las contraseñas no coinciden');
      return;
    }
  
    this.http.post('http://localhost:8080/api/auth/signup', this.form)
      .pipe(
        catchError((error) => {
          if (error.status === 400 && error.error?.message === 'Username is already taken!') {
            this.usernameTaken = true;
          }
          return of(null);
        })
      )
      .subscribe({
        next: (res) => {
          if (res) {
            this.showToastMessage('Registro exitoso', 'success');
            this.authService.login({
              username: this.form.username,
              password: this.form.password
            }).subscribe({
              next: () => {
                void this.router.navigate(['/carta']);
              },
              error: () => {
                this.showToastMessage('Error al iniciar sesión automáticamente');
              }
            });
          }
        },
        error: (err) => {
          console.error('❌ Error al registrarse', err);
          if (!this.usernameTaken && !this.usernameRestricted) {
            this.showToastMessage('Error al registrarse en el servidor');
          }
        }
      });
  }    
}