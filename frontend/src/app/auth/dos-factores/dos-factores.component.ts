import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, SesionAbierta } from '../auth.service';
import { CodigoQrService } from './codigo-qr.service';
import { CodigosRecuperacionComponent } from '../../shared/codigos-recuperacion/codigos-recuperacion.component';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

/** Lo que el login deja en el estado del historial al navegar aqui. */
interface EstadoDesafio {
  desafio?: string;
  configurar?: boolean;
  usuario?: string;
}

type Paso = 'cargando' | 'verificar' | 'configurar' | 'codigos' | 'recuperacionUsada' | 'caducado';

/**
 * Segundo paso del login (/auth/2fa).
 * - verificar: codigo de 6 digitos de la app o, si no tiene el movil, un codigo de recuperacion;
 * - configurar: el personal que aun no la tiene escanea el QR, escribe el primer codigo y recibe
 *   los codigos de recuperacion, que solo se muestran esa vez.
 */
@Component({
  selector: 'app-dos-factores',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, CodigosRecuperacionComponent, TraducirPipe],
  templateUrl: './dos-factores.component.html',
  styleUrls: ['../correo/cuenta-correo.css', './dos-factores.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class DosFactoresComponent implements OnInit {
  private readonly idiomas = inject(IdiomaService);
  private readonly authService = inject(AuthService);
  private readonly codigoQr = inject(CodigoQrService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });
  paso: Paso = 'cargando';
  usarRecuperacion = false;
  usuario = '';
  secreto = '';
  qr = '';
  codigosRecuperacion: string[] = [];
  restantes = 0;
  enviando = false;
  error = '';
  mensajeCaducado = '';
  private desafio = '';

  ngOnInit(): void {
    const estado = (history.state ?? {}) as EstadoDesafio;
    this.usuario = estado.usuario ?? '';
    if (!estado.desafio) {
      // Recarga tras entrar (la sesion ya esta abierta) o enlace directo sin pasar por el login
      if (this.authService.isAuthenticated()) {
        this.continuar();
      } else {
        this.caducar(this.idiomas.t('dosf.empezar'));
      }
      return;
    }
    this.desafio = estado.desafio;
    if (estado.configurar) {
      this.empezarConfiguracion();
    } else {
      this.paso = 'verificar';
    }
  }

  get codigo(): FormControl<string> {
    return this.form.controls.codigo;
  }

  /** La clave en grupos de 4, para escribirla a mano en la app. */
  get secretoAgrupado(): string {
    return this.secreto.replace(/(.{4})(?=.)/g, '$1 ');
  }

  /** Cambia entre el codigo de la app y un codigo de recuperacion. */
  alternarRecuperacion(): void {
    this.usarRecuperacion = !this.usarRecuperacion;
    this.codigo.reset();
    this.error = '';
  }

  enviar(): void {
    const codigo = this.codigo.value.trim();
    if (!codigo || this.enviando) {
      this.codigo.markAsTouched();
      return;
    }
    this.enviando = true;
    this.error = '';
    const peticion = this.paso === 'configurar'
      ? this.authService.activarDosFactores(this.desafio, codigo)
      : this.authService.verificarDosFactores(this.desafio, codigo);
    peticion.subscribe({
      next: res => this.sesionAbierta(res),
      error: err => this.fallo(err)
    });
  }

  continuar(): void {
    void this.router.navigate(['/carta']);
  }

  private empezarConfiguracion(): void {
    this.authService.configurarDosFactores(this.desafio).subscribe({
      next: configuracion => {
        this.secreto = configuracion.secreto;
        this.paso = 'configurar';
        // Si el QR no se puede dibujar, la clave escrita sigue sirviendo
        this.codigoQr.comoImagen(configuracion.uri).then(imagen => {
          this.qr = imagen;
          this.cdr.markForCheck();
        }, () => undefined);
      },
      error: err => this.fallo(err)
    });
  }

  private sesionAbierta(res: SesionAbierta): void {
    this.enviando = false;
    // El desafio ya esta usado: si se recarga la pagina no hay que volver a intentarlo
    history.replaceState({ ...history.state, desafio: undefined }, '');
    if (res.codigosRecuperacion?.length) {
      this.codigosRecuperacion = res.codigosRecuperacion;
      this.paso = 'codigos';
    } else if (res.codigosRecuperacionRestantes != null) {
      this.restantes = res.codigosRecuperacionRestantes;
      this.paso = 'recuperacionUsada';
    } else {
      this.continuar();
    }
  }

  private fallo(err: any): void {
    this.enviando = false;
    const codigo = err?.error?.code;
    if (err?.status === 401 && codigo === 'CODIGO_INCORRECTO') {
      this.error = this.idiomas.delServidor(err.error.message, 'dosf.incorrecto');
      this.codigo.reset();
    } else if (err?.status === 401 || err?.status === 429) {
      this.caducar(this.idiomas.delServidor(err.error?.message, 'dosf.volverAEntrar'));
    } else {
      this.error = this.idiomas.t('dosf.error');
    }
  }

  private caducar(mensaje: string): void {
    this.paso = 'caducado';
    this.mensajeCaducado = mensaje;
    this.desafio = '';
  }
}
