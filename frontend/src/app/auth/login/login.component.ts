import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService, esDesafio } from '../auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { IdiomaService } from '../../shared/i18n/idioma.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LoginComponent implements OnInit {
  private readonly idiomas = inject(IdiomaService);
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
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // El interceptor manda aqui con ?sesion=caducada cuando la sesion ya no se puede renovar
    if (this.route.snapshot.queryParamMap.get('sesion') === 'caducada') {
      this.showToastMessage(this.idiomas.t('login.caducada'), 'info', 6000);
    }
  }

  /** Login correcto pero sin confirmar el correo: se ofrece reenviar el enlace. */
  pendienteConfirmar = false;

  reenviarConfirmacion(): void {
    this.authService.reenviarConfirmacion(this.form.value.username).subscribe({
      next: res => this.showToastMessage(this.idiomas.delServidor(res.message, 'auth.reenviado'), 'success', 6000),
      error: () => this.showToastMessage(this.idiomas.t('auth.reenviarError'), 'error')
    });
  }

  private mensajeDeError(err: any): string {
    if (err?.status === 403 && err.error?.code === 'EMAIL_NO_VERIFICADO') {
      return this.idiomas.delServidor(err.error.message, 'login.sinConfirmar');
    }
    if (err?.status === 429) {
      return this.idiomas.delServidor(err.error?.message, 'login.bloqueo');
    }
    if (err?.status === 401) {
      return this.idiomas.t('login.incorrecto');
    }
    return this.idiomas.t('login.error');
  }

  onSubmit() {
    if (this.form.invalid) return;
  
    const credentials = {
      username: this.form.value.username,
      password: this.form.value.password
    };
  
    this.pendienteConfirmar = false;
    this.authService.login(credentials).subscribe({
      next: res => {
        if (esDesafio(res)) {
          // Falta el segundo paso: el desafio viaja en el estado del historial, no en la URL
          void this.router.navigate(['/auth/2fa'], {
            state: { desafio: res.desafio, configurar: res.configurar, usuario: credentials.username }
          });
          return;
        }
        void this.router.navigate(['/carta']);
      },
      error: (err) => {
        this.pendienteConfirmar = err?.status === 403 && err.error?.code === 'EMAIL_NO_VERIFICADO';
        const duracion = err?.status === 429 || this.pendienteConfirmar ? 8000 : 3000;
        this.showToastMessage(this.mensajeDeError(err), 'error', duracion);
      }
    });
  }
}