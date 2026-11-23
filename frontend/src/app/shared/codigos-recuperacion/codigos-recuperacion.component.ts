import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/**
 * Lista de códigos de recuperación recién generados, con Descargar y Copiar, y un botón que no se
 * activa hasta marcar «He guardado los códigos». Se usa al activar la verificación en dos pasos
 * (en el login y en el perfil) y al generar códigos nuevos.
 */
@Component({
  selector: 'app-codigos-recuperacion',
  standalone: true,
  templateUrl: './codigos-recuperacion.component.html',
  styleUrls: ['./codigos-recuperacion.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodigosRecuperacionComponent {
  readonly codigos = input.required<string[]>();
  /** Para el encabezado del archivo descargado. */
  readonly usuario = input('');
  readonly textoBoton = input('Continuar');
  readonly terminado = output<void>();

  readonly guardados = signal(false);
  readonly copiados = signal(false);

  descargar(): void {
    const usuario = this.usuario();
    const texto = [
      'BarHub - códigos de recuperación' + (usuario ? ` de ${usuario}` : ''),
      '',
      'Cada código sirve una sola vez para entrar si no tienes la app de autenticación.',
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
