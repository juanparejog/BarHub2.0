import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { borrarFragmento, tokenDelFragmento } from './token-del-enlace';

/** Mismas reglas que en el registro: 8 a 40 caracteres con minuscula, mayuscula y numero. */
const CLAVE_SEGURA = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,40}$/;

/** Pagina del enlace de recuperacion: elige una contrasena nueva. */
@Component({
  selector: 'app-restablecer',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './restablecer.component.html',
  styleUrls: ['./cuenta-correo.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class RestablecerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly authService = inject(AuthService);

  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(CLAVE_SEGURA)] }),
    repetir: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });
  private token = '';
  enlaceIncompleto = false;
  guardando = false;
  cambiada = false;
  mensaje = '';
  error = '';

  ngOnInit(): void {
    this.token = tokenDelFragmento(this.route.snapshot.fragment);
    borrarFragmento(this.location);
    this.enlaceIncompleto = !this.token;
  }

  get noCoinciden(): boolean {
    const { password, repetir } = this.form.controls;
    return repetir.touched && password.value !== repetir.value;
  }

  cambiar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.noCoinciden) {
      return;
    }
    this.guardando = true;
    this.error = '';
    this.authService.restablecerContrasena(this.token, this.form.controls.password.value).subscribe({
      next: respuesta => {
        this.cambiada = true;
        this.mensaje = respuesta.message;
        this.guardando = false;
      },
      error: err => {
        this.error = err?.error?.message ?? 'No se pudo cambiar la contraseña. Inténtalo más tarde.';
        this.guardando = false;
      }
    });
  }
}
