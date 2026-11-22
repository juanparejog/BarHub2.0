import { defineConfig, devices } from '@playwright/test';

const enCi = !!process.env.CI;

/**
 * Tests de extremo a extremo contra BarHub levantado con Docker Compose (Caddy en el puerto 80).
 * En el CI la base de datos es nueva en cada ejecucion; en local se crean usuarios e2e_* y pedidos de prueba.
 */
export default defineConfig({
  testDir: './tests',
  // Espera a que la API responda (justo despues de docker compose up aun esta arrancando)
  globalSetup: './global-setup.ts',
  // Comparten base de datos (pedidos, caja): uno detras de otro y en orden de archivo
  fullyParallel: false,
  workers: 1,
  forbidOnly: enCi,
  retries: enCi ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: enCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // Las animaciones terminan al instante (regla global de styles.css)
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
