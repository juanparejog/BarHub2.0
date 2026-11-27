import { Injectable } from '@angular/core';

const CLAVE = 'barhub.avisoSonoroComandas';

/**
 * Pitido corto cuando entra una comanda nueva, generado con Web Audio (sin ficheros de sonido).
 * Lo activa cada persona en su navegador y se recuerda. Los navegadores solo dejan sonar después de
 * que el usuario haya pulsado algo en la página: por eso el audio se prepara al activarlo.
 */
@Injectable({ providedIn: 'root' })
export class AvisoSonoroService {
  private contexto: AudioContext | null = null;
  private activo = leer();

  get activado(): boolean {
    return this.activo;
  }

  /** Se llama desde el clic en el botón, que es lo que permite al navegador reproducir sonido. */
  alternar(): void {
    this.activo = !this.activo;
    guardar(this.activo);
    if (this.activo) {
      this.prepararAudio();
      this.sonar();
    }
  }

  /** Dos pitidos cortos. No hace nada si está desactivado o el navegador no tiene Web Audio. */
  sonar(): void {
    if (!this.activo) {
      return;
    }
    const contexto = this.prepararAudio();
    if (!contexto) {
      return;
    }
    const inicio = contexto.currentTime;
    for (const desfase of [0, 0.22]) {
      const oscilador = contexto.createOscillator();
      const volumen = contexto.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.value = 880;
      volumen.gain.setValueAtTime(0.25, inicio + desfase);
      volumen.gain.exponentialRampToValueAtTime(0.001, inicio + desfase + 0.18);
      oscilador.connect(volumen).connect(contexto.destination);
      oscilador.start(inicio + desfase);
      oscilador.stop(inicio + desfase + 0.2);
    }
  }

  private prepararAudio(): AudioContext | null {
    try {
      this.contexto ??= new AudioContext();
      if (this.contexto.state === 'suspended') {
        void this.contexto.resume();
      }
      return this.contexto;
    } catch {
      return null;
    }
  }
}

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'si';
  } catch {
    return false;
  }
}

function guardar(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE, activo ? 'si' : 'no');
  } catch {
    // Sin almacenamiento: vale para esta visita
  }
}
