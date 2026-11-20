import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    standalone: false
})
export class LoginComponent {
  form: FormGroup;
  errorMessage: string = '';
  showPassword = false;
  showConfirmPassword = false;
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info', duracionMs = 3000) {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, duracionMs);
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  private mensajeDeError(err: any): string {
    if (err?.status === 429) {
      return err.error?.message ?? 'Demasiados intentos fallidos. Vuelve a intentarlo más tarde.';
    }
    if (err?.status === 401) {
      return 'Usuario o contraseña incorrectos';
    }
    return 'No se pudo iniciar sesión. Inténtalo de nuevo más tarde';
  }

  onSubmit() {
    if (this.form.invalid) return;
  
    const credentials = {
      username: this.form.value.username,
      password: this.form.value.password
    };
  
    this.authService.login(credentials).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
      
        const payload = JSON.parse(atob(res.token.split('.')[1]));

        localStorage.setItem('roles', JSON.stringify(payload.roles));
        localStorage.setItem('username', payload.username || payload.sub);
        
        const userId = payload.id || payload.userId || res.id;
        if (userId) {
          localStorage.setItem('usuarioId', userId.toString());
        }


        void this.router.navigate(['/carta']);
      },
      error: (err) => {
        console.error('Error de login:', err);
        this.showToastMessage(this.mensajeDeError(err), 'error', err?.status === 429 ? 8000 : 3000);
      }
    });
  }
}