import { test as base, expect, type Page } from '@playwright/test';

/** Administrador creado por DemoDataSeeder (APP_SEED_ADMIN_USERNAME y APP_SEED_ADMIN_PASSWORD). */
export const ADMIN = {
  usuario: process.env.E2E_ADMIN_USER ?? 'admin',
  get clave(): string {
    const clave = process.env.E2E_ADMIN_PASSWORD;
    if (!clave) {
      throw new Error('Define E2E_ADMIN_PASSWORD con la contraseña del administrador para los tests del personal.');
    }
    return clave;
  },
};

/**
 * En cada test:
 * - falla si la pagina lanza un error de JavaScript no capturado (por ejemplo, una app que no arranca);
 * - solo se permiten peticiones a la propia aplicacion. Stripe, Google Maps y Google Fonts se bloquean
 *   para que el resultado no dependa de servicios de terceros.
 */
export const test = base.extend<{ erroresPagina: string[] }>({
  erroresPagina: [
    async ({ page, baseURL }, use) => {
      const errores: string[] = [];
      page.on('pageerror', (error) => errores.push(error.message));
      const propio = new URL(baseURL ?? 'http://localhost').host;
      await page.context().route('**/*', (ruta) =>
        new URL(ruta.request().url()).host === propio ? ruta.continue() : ruta.abort(),
      );
      await use(errores);
      expect(errores, 'errores de JavaScript en la página').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function iniciarSesion(page: Page, usuario: string, clave: string): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('input[formcontrolname="username"]').fill(usuario);
  await page.locator('input[formcontrolname="password"]').fill(clave);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/carta$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
}

/**
 * Visita una ruta protegida y devuelve el aviso que muestra RoleGuard al denegar el acceso.
 * El aviso se acepta en cuanto aparece: si se esperase a que termine la navegacion, el alert
 * bloquearia la pagina y la carga no acabaria nunca.
 */
export async function avisoAlVisitar(page: Page, ruta: string): Promise<string> {
  let mensaje = '';
  page.once('dialog', async (dialogo) => {
    mensaje = dialogo.message();
    await dialogo.accept();
  });
  await page.goto(ruta);
  await expect.poll(() => mensaje).not.toBe('');
  return mensaje;
}
