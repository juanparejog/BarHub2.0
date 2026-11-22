import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

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

/**
 * Filas con datos de las tablas de gestion. Mientras carga, o si no hay datos, la tabla muestra una
 * sola celda con el aviso ("No hay usuarios...") que tambien es una fila: esa no cuenta.
 */
export function filasConDatos(page: Page) {
  return page.locator('table.crud-table tbody tr:has(td + td)');
}

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

/** Bandeja de Mailpit, que captura los correos del backend en local y en el CI. */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/**
 * Enlace del ultimo correo recibido por {@code email} que lleve a {@code ruta}
 * ('verificar' o 'restablecer'), como ruta relativa lista para page.goto(). El correo se envia en
 * segundo plano, asi que se espera a que llegue.
 */
export async function enlaceDelCorreo(request: APIRequestContext, email: string, ruta: string): Promise<string> {
  const patron = new RegExp(`/auth/${ruta}#token=[\\w-]+`);
  let enlace: string | undefined;
  await expect.poll(async () => {
    const busqueda = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"` } });
    if (!busqueda.ok()) {
      return undefined;
    }
    for (const resumen of (await busqueda.json()).messages ?? []) {
      const mensaje = await (await request.get(`${MAILPIT}/api/v1/message/${resumen.ID}`)).json();
      const encontrado = patron.exec(mensaje.Text ?? '');
      if (encontrado) {
        enlace = encontrado[0];
        return enlace;
      }
    }
    return undefined;
  }, { message: `correo con /auth/${ruta} para ${email} en Mailpit`, timeout: 20_000 }).toBeDefined();
  return enlace!;
}

/** Registra un cliente desde el formulario y confirma su correo con el enlace de Mailpit. */
export async function registrarYConfirmar(
  page: Page, request: APIRequestContext, cliente: { usuario: string; clave: string; email: string }
): Promise<void> {
  await page.goto('/auth/register');
  await page.getByPlaceholder('Usuario', { exact: true }).fill(cliente.usuario);
  await page.getByPlaceholder('Nombre', { exact: true }).fill('Prueba');
  await page.getByPlaceholder('Primer apellido', { exact: true }).fill('E2E');
  await page.getByPlaceholder('Correo electrónico', { exact: true }).fill(cliente.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(cliente.clave);
  await page.getByPlaceholder('Repite tu contraseña', { exact: true }).fill(cliente.clave);
  await page.locator('input[name="politicas"]').check();
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

  await page.goto(await enlaceDelCorreo(request, cliente.email, 'verificar'));
  await expect(page.getByText('Correo confirmado. Ya puedes iniciar sesión.')).toBeVisible();
}
