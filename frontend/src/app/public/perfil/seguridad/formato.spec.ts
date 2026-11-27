import { describirNavegador, esMovil, fechaHora, haceCuanto } from './formato';

describe('formato de las sesiones', () => {
  const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
  const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
  const EDGE_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0';
  const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  it('reconoce el navegador y el sistema', () => {
    expect(describirNavegador(FIREFOX_LINUX)).toBe('Firefox en Linux');
    expect(describirNavegador(CHROME_ANDROID)).toBe('Chrome en Android');
    expect(describirNavegador(EDGE_WINDOWS)).toBe('Edge en Windows');
    expect(describirNavegador(SAFARI_IPHONE)).toBe('Safari en iOS');
    expect(describirNavegador(null)).toBe('Navegador desconocido');
    expect(describirNavegador('curl/8.0')).toBe('Navegador');
  });

  it('distingue los móviles', () => {
    expect(esMovil(CHROME_ANDROID)).toBe(true);
    expect(esMovil(SAFARI_IPHONE)).toBe(true);
    expect(esMovil(FIREFOX_LINUX)).toBe(false);
  });

  it('dice hace cuánto en español', () => {
    const ahora = Date.UTC(2026, 10, 23, 12, 0);
    expect(haceCuanto(ahora - 20_000, ahora)).toBe('ahora mismo');
    expect(haceCuanto(ahora - 60_000, ahora)).toBe('hace 1 minuto');
    expect(haceCuanto(ahora - 5 * 60_000, ahora)).toBe('hace 5 minutos');
    expect(haceCuanto(ahora - 2 * 3_600_000, ahora)).toBe('hace 2 horas');
    expect(haceCuanto(ahora - 3 * 86_400_000, ahora)).toBe('hace 3 días');
  });
});

describe('formato de las sesiones en portugués e inglés', () => {
  const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
  const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
  const ahora = Date.UTC(2026, 10, 23, 12, 0);
  it('describe el navegador y el tiempo en el idioma elegido', () => {
    expect(describirNavegador(FIREFOX_LINUX, 'en')).toBe('Firefox on Linux');
    expect(describirNavegador(CHROME_ANDROID, 'pt')).toBe('Chrome em Android');
    expect(describirNavegador(null, 'en')).toBe('Unknown browser');
    expect(haceCuanto(ahora - 30_000, ahora, 'en')).toBe('just now');
    expect(haceCuanto(ahora - 2 * 3_600_000, ahora, 'pt')).toBe('há 2 horas');
    expect(haceCuanto(ahora - 86_400_000, ahora, 'en')).toBe('1 day ago');
    expect(fechaHora(ahora, 'en')).toMatch(/^23\/11\/2026, \d{2}:\d{2}$/);
  });
});
