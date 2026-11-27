import { vi } from 'vitest';

import { AvisoSonoroService } from './aviso-sonoro.service';

/** Web Audio falso: cuenta los pitidos que se programan. */
class AudioContextFalso {
  static osciladores = 0;
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });

  createOscillator() {
    AudioContextFalso.osciladores++;
    return { type: '', frequency: { value: 0 }, connect: (destino: unknown) => destino, start: vi.fn(), stop: vi.fn() };
  }

  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (destino: unknown) => destino
    };
  }
}

describe('AvisoSonoroService', () => {
  beforeEach(() => {
    localStorage.removeItem('barhub.avisoSonoroComandas');
    AudioContextFalso.osciladores = 0;
    vi.stubGlobal('AudioContext', AudioContextFalso);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('viene desactivado y, así, no suena', () => {
    const aviso = new AvisoSonoroService();
    expect(aviso.activado).toBe(false);
    aviso.sonar();
    expect(AudioContextFalso.osciladores).toBe(0);
  });

  it('al activarlo suena de prueba, se recuerda y suena con cada comanda', () => {
    const aviso = new AvisoSonoroService();
    aviso.alternar();
    expect(aviso.activado).toBe(true);
    expect(AudioContextFalso.osciladores).toBe(2);
    expect(localStorage.getItem('barhub.avisoSonoroComandas')).toBe('si');

    const otraVisita = new AvisoSonoroService();
    expect(otraVisita.activado).toBe(true);
    otraVisita.sonar();
    expect(AudioContextFalso.osciladores).toBe(4);

    otraVisita.alternar();
    expect(otraVisita.activado).toBe(false);
    expect(localStorage.getItem('barhub.avisoSonoroComandas')).toBe('no');
  });

  it('sin Web Audio no falla', () => {
    vi.stubGlobal('AudioContext', undefined);
    const aviso = new AvisoSonoroService();
    expect(() => aviso.alternar()).not.toThrow();
    expect(() => aviso.sonar()).not.toThrow();
  });
});
