import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { IdiomaService } from '../i18n/idioma.service';
import { TraducirPipe } from '../i18n/traducir.pipe';

/**
 * Lista de códigos de recuperación recién generados, con Descargar y Copiar, y un botón que no se
 * activa hasta marcar «He guardado los códigos». Se usa al activar la verificación en dos pasos
 * (en el login y en el perfil) y al generar códigos nuevos.
 */
@Component({
  selector: 'app-codigos-recuperacion',
  standalone: true,
  imports: [TraducirPipe],
  templateUrl: './codigos-recuperacion.component.html',
  styleUrls: ['./codigos-recuperacion.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodigosRecuperacionComponent {
  readonly codigos = input.required<string[]>();
  /** Para el encabezado del archivo descargado. */
  readonly usuario = input('');
  /** Vacío: «Continuar» en el idioma elegido. */
  readonly textoBoton = input('');
  private readonly idiomas = inject(IdiomaService);
  readonly terminado = output<void>();

  readonly guardados = signal(false);
  readonly copiados = signal(false);

  descargar(): void {
    const usuario = this.usuario();
    const texto = [
      usuario ? this.idiomas.t('codigos.archivo.de', { usuario }) : this.idiomas.t('codigos.archivo'),
      '',
      this.idiomas.t('codigos.archivo.ayuda'),
      '',
      ...this.codigos()
    ].join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([texto + '\n'], { type: 'text/plain;charset=utf-8' }));
    enlace.download = 'barhub-codigos-recuperacion.txt';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  copiar(): void {
    navigator.clipboard?.writeText(this.codigos().join('\n')).then(() => this.copiados.set(true), () => undefined);
  }
}
