import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CodigoQrService } from '../../../auth/dos-factores/codigo-qr.service';
import { DialogService } from '../../../main/services/shared/services/dialog.service';
import { CodigosRecuperacionComponent } from '../../../shared/codigos-recuperacion/codigos-recuperacion.component';
import { PerfilService } from '../perfil.service';

type Vista = 'estado' | 'configurar' | 'codigos';

/**
 * Verificación en dos pasos de la propia cuenta: activarla (QR o clave y primer código), generar
 * códigos de recuperación nuevos y, si su rol no la exige, quitarla. Las tres acciones pueden pedir
 * antes el código o la contraseña (reautenticación): eso lo resuelve el interceptor con su ventana.
 */
@Component({
  selector: 'app-perfil-dos-factores',
  standalone: true,
  imports: [ReactiveFormsModule, CodigosRecuperacionComponent],
  templateUrl: './perfil-dos-factores.component.html',
  styleUrls: ['../perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilDosFactoresComponent {
  readonly perfil = inject(PerfilService);
  private readonly codigoQr = inject(CodigoQrService);
  private readonly dialogos = inject(DialogService);

  readonly vista = signal<Vista>('estado');
  readonly secreto = signal('');
  readonly qr = signal('');
  readonly codigosNuevos = signal<string[]>([]);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly codigo = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly secretoAgrupado = computed(() => this.secreto().replace(/(.{4})(?=.)/g, '$1 '));
  readonly usuario = computed(() => this.perfil.usuario()?.username ?? '');

  empezar(): void {
    this.limpiarMensajes();
    this.enviando.set(true);
    this.perfil.configurarDosFactores().subscribe({
      next: configuracion => {
        this.enviando.set(false);
        this.secreto.set(configuracion.secreto);
        this.qr.set('');
        this.codigo.reset();
        this.vista.set('configurar');
        // Sin QR sigue sirviendo la clave escrita
        this.codigoQr.comoImagen(configuracion.uri).then(imagen => this.qr.set(imagen), () => undefined);
      },
      error: err => this.fallo(err, 'No se pudo empezar la configuración.')
    });
  }

  activar(): void {
    const codigo = this.codigo.value.trim();
    if (!codigo || this.enviando()) {
      this.codigo.markAsTouched();
      return;
    }
    this.limpiarMensajes();
    this.enviando.set(true);
    this.perfil.activarDosFactores(codigo).subscribe({
      next: codigos => {
        this.enviando.set(false);
        this.codigosNuevos.set(codigos);
        this.vista.set('codigos');
      },
      error: err => {
        this.codigo.reset();
        this.fallo(err, 'No se pudo activar.');
      }
    });
  }

  cancelar(): void {
    this.limpiarMensajes();
    this.vista.set('estado');
  }

  regenerar(): void {
    this.dialogos.solicitarConfirmacion(
      'Los códigos de recuperación que tienes ahora dejarán de valer y recibirás 10 nuevos.',
      'Generar códigos nuevos',
      () => {
        this.limpiarMensajes();
        this.perfil.regenerarCodigos().subscribe({
          next: codigos => {
            this.codigosNuevos.set(codigos);
            this.vista.set('codigos');
          },
          error: err => this.fallo(err, 'No se pudieron generar códigos nuevos.')
        });
      });
  }

  desactivar(): void {
    this.dialogos.solicitarConfirmacion(
      'Para entrar solo te pediremos la contraseña. Tus códigos de recuperación dejarán de valer.',
      'Desactivar la verificación en dos pasos',
      () => {
        this.limpiarMensajes();
        this.perfil.desactivarDosFactores().subscribe({
          next: () => this.aviso.set('Verificación en dos pasos desactivada.'),
          error: err => this.fallo(err, 'No se pudo desactivar.')
        });
      });
  }

  terminar(): void {
    this.codigosNuevos.set([]);
    this.vista.set('estado');
    this.aviso.set('Listo: guarda bien tus códigos de recuperación.');
  }

  private limpiarMensajes(): void {
    this.error.set('');
    this.aviso.set('');
  }

  private fallo(err: any, porDefecto: string): void {
    this.enviando.set(false);
    // Si cancela la ventana de confirmar su identidad no hace falta otro aviso
    if (err?.error?.code === 'REAUTENTICACION_REQUERIDA') {
      return;
    }
    this.error.set(err?.error?.message ?? porDefecto);
  }
}
