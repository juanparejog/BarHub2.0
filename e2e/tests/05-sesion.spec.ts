import { test, expect, iniciarSesion, crearClienteConfirmado } from './fixtures';

const COOKIE = 'barhub_refresh';

/**
 * Con un cliente: entra sin segundo paso, asi que cada test puede iniciar sesion sin esperar al
 * siguiente codigo TOTP (el del administrador no se puede repetir en 30 segundos).
 */
let cliente: { usuario: string; clave: string };

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: process.env.E2E_URL ?? 'http://localhost' });
  cliente = await crearClienteConfirmado(request, 'e2es');
  await request.dispose();
});

/** Respuesta correcta de la API de "mis pedidos", que la pagina de seguimiento pide al cargar. */
function misPedidosCargados(page: import('@playwright/test').Page) {
  return page.waitForResponse(r => r.url().endsWith('/api/pedidos/mis-pedidos') && r.status() === 200);
}

test.describe('Sesión con token de acceso corto y renovación', () => {
  test('la renovación va en una cookie HttpOnly y SameSite=Strict que JavaScript no puede leer', async ({ page, context }) => {
    await iniciarSesion(page, cliente.usuario, cliente.clave);

    const cookie = (await context.cookies()).find(c => c.name === COOKIE);
    expect(cookie, 'cookie de renovación').toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Strict');
    expect(cookie!.path).toBe('/api/auth');
    expect(await page.evaluate(() => document.cookie)).not.toContain(COOKIE);
  });

  test('con el token de acceso caducado, la sesión se renueva sola y la página carga', async ({ page }) => {
    await iniciarSesion(page, cliente.usuario, cliente.clave);
    // Un token que el backend rechaza hace el mismo papel que uno caducado
    await page.evaluate(() => localStorage.setItem('token', 'caducado.no.valido'));

    const renovacion = page.waitForResponse(r => r.url().endsWith('/api/auth/refresh'));
    const pedidos = misPedidosCargados(page);
    await page.goto('/seguimiento-pedidos');
    expect((await renovacion).status()).toBe(200);

    // La peticion que fallo se repite con el token nuevo y esta vez responde bien
    await pedidos;
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toMatch(/^eyJ/);
  });

  test('si la sesión ya no se puede renovar, lleva al login con el aviso', async ({ page, context }) => {
    await iniciarSesion(page, cliente.usuario, cliente.clave);
    await context.clearCookies();
    await page.evaluate(() => localStorage.setItem('token', 'caducado.no.valido'));

    await page.goto('/seguimiento-pedidos');
    await expect(page).toHaveURL(/\/auth\/login\?sesion=caducada$/);
    await expect(page.getByText('Tu sesión ha caducado. Vuelve a iniciar sesión.')).toBeVisible();
  });

  test('cerrar sesión la revoca en el servidor: la cookie y el token copiados dejan de valer', async ({ page, context }) => {
    await iniciarSesion(page, cliente.usuario, cliente.clave);
    const cookie = (await context.cookies()).find(c => c.name === COOKIE)!;
    const acceso = await page.evaluate(() => localStorage.getItem('token'));

    await page.locator('app-menu').getByRole('link', { name: /^Avatar/ }).click();
    await page.getByRole('link', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect.poll(async () => (await context.cookies()).some(c => c.name === COOKIE)).toBe(false);

    const renovar = await page.request.post('/api/auth/refresh', { headers: { Cookie: `${COOKIE}=${cookie.value}` } });
    expect(renovar.status()).toBe(401);
    const conToken = await page.request.get('/api/pedidos/mis-pedidos', { headers: { Authorization: `Bearer ${acceso}` } });
    expect(conToken.status()).toBe(401);
  });

  /** Simula que el usuario lleva sin tocar nada hasta {@code restanteMs} antes del cierre por inactividad. */
  async function inactivoHastaFaltar(page: import('@playwright/test').Page, restanteMs: number): Promise<void> {
    await page.evaluate((restante) => {
      const { inactividadMs } = JSON.parse(localStorage.getItem('sesion') ?? '{}');
      localStorage.setItem('sesionInteraccion', String(Date.now() - inactividadMs + restante));
    }, restanteMs);
  }

  test('avisa antes de cerrar por inactividad y "Seguir conectado" mantiene la sesión', async ({ page }) => {
    await iniciarSesion(page, cliente.usuario, cliente.clave);
    await inactivoHastaFaltar(page, 60_000);

    const aviso = page.getByRole('alertdialog', { name: '¿Sigues ahí?' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(/0:5\d|1:00/);

    const renovacion = page.waitForResponse(r => r.url().endsWith('/api/auth/refresh'));
    await aviso.getByRole('button', { name: 'Seguir conectado' }).click();
    expect((await renovacion).status()).toBe(200);
    await expect(aviso).toBeHidden();
  });

  test('si nadie responde al aviso, la sesión se cierra también en el servidor', async ({ page, context }) => {
    await iniciarSesion(page, cliente.usuario, cliente.clave);
    await inactivoHastaFaltar(page, 3_000);

    await expect(page.getByRole('alertdialog', { name: '¿Sigues ahí?' })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login\?sesion=caducada$/, { timeout: 15_000 });
    await expect(page.getByText('Tu sesión ha caducado. Vuelve a iniciar sesión.')).toBeVisible();
    await expect.poll(async () => (await context.cookies()).some(c => c.name === COOKIE)).toBe(false);
  });
});
