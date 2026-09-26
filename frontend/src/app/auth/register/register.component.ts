import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { Component, NgModule } from '@angular/core';
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
    role: ['ROLE_CLIENTE']
  };
  aceptaPoliticas = false;
  confirmPassword = '';
  usernameTaken = false;
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
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
    ) {}

    onSubmit(): void {
      this.usernameTaken = false;
    
      if (this.form.password !== this.confirmPassword) {
        this.showToastMessage('Las contraseñas no coinciden');
        return;
      }
    
      this.http.post('http://localhost:8080/api/auth/signup', this.form)
        .pipe(
          catchError((error) => {
            if (error.status === 400 && error.error.message === 'Username is already taken!') {
              this.usernameTaken = true;
            }
            return of(null);
          })
        )
        .subscribe({
          next: (res) => {
            if (res) {
              this.showToastMessage('Registro exitoso');
              this.authService.login({
                username: this.form.username,
                password: this.form.password
              }).subscribe({
                next: () => {
                  this.router.navigate(['/carta']);
                },
                error: err => {
                  this.showToastMessage('Error al iniciar sesión automáticamente');
                }
              });
            }
          },
          error: (err) => {
            console.error('❌ Error al registrarse', err);
            if (!this.usernameTaken) {
              this.showToastMessage('Error al registrarse');
            }
          }
        });
    }    
}