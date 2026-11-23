import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect, iniciarSesion, crearClienteConfirmado, codigoSinUsar } from './fixtures';

/**
 * Mi perfil con pestañas: cada una con su URL y su propio guardado; en Seguridad, cambiar la
 * contraseña cierra las demás sesiones, se ven y se cierran las sesiones abiertas, y un cliente
 * activa (y quita) la verificación en dos pasos.
 */
test.describe.configure({ mode: 'serial' });

const URL_BASE = process.env.E2E_URL ?? 'http://localhost';
let cliente: { usuario: string; clave: string };

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: URL_BASE });
  cliente = await crearClienteConfirmado(request, 'e2ep');
  await request.dispose();
});

/** Otra sesión del mismo cliente, como si entrara desde otro navegador. */
async function otroNavegador(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }) {
  const otro = await playwright.request.newContext({ baseURL: URL_BASE });
  const login = await otro.post('/api/auth/login', { data: { username: cliente.usuario, password: cliente.clave } });
  expect(login.ok()).toBe(true);
  return otro;
}

function cabecera(page: Page) {
  return page.locator('header.perfil-cabecera');
}

async function irA(page: Page, pestana: string): Promise<void> {
  await page.locator('nav[aria-label="Secciones del perfil"]').getByRole('link', { name: pestana }).click();
}

test('el perfil se organiza en pestañas, cada una con su dirección', async ({ page }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await page.goto('/perfil');

  await expect(page).toHaveURL(/\/perfil\/datos$/);
  await expect(page.locator('header.perfil-cabecera h1')).toContainText('Prueba E2E');
  await expect(cabecera(page).getByText('Correo verificado')).toBeVisible();
  await expect(cabecera(page).getByText('Verificación en dos pasos desactivada')).toBeVisible();

  await irA(page, 'Seguridad');
  await expect(page).toHaveURL(/\/perfil\/seguridad$/);
  await expect(page.getByRole('heading', { name: 'Seguridad', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/perfil\/datos$/);
});

test('datos personales y dirección se guardan cada uno por su lado', async ({ page }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await page.goto('/perfil/datos');
  await page.getByLabel('Segundo apellido').fill('Pruebas');
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(page.getByText('Datos guardados.')).toBeVisible();

  await irA(page, 'Dirección de entrega');
  await page.getByLabel('Teléfono de contacto').fill('600123456');
  await page.getByLabel('Código postal').fill('06001');
  await page.getByLabel('Calle, avenida o vía').fill('Calle Menacho 12');
  await page.getByText('Casa', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Número de la casa' }).fill('7');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByText('Dirección guardada.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Calle, avenida o vía')).toHaveValue('Calle Menacho 12');
  await expect(page.getByRole('textbox', { name: 'Número de la casa' })).toHaveValue('7');
  await irA(page, 'Datos personales');
  await expect(page.getByLabel('Segundo apellido')).toHaveValue('Pruebas');
  await expect(page.locator('header.perfil-cabecera h1')).toContainText('Prueba E2E Pruebas');
});

test('cambiar la contraseña cierra la sesión del otro navegador', async ({ page, playwright }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  const otro = await otroNavegador(playwright);

  await page.goto('/perfil/seguridad');
  const nueva = `${cliente.clave}x`;
  await page.getByLabel('Contraseña actual').fill(cliente.clave);
  await page.getByLabel('Nueva contraseña').fill(nueva);
  await page.getByLabel('Repite la nueva').fill(nueva);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  // Siguen abiertas también las sesiones de los tests anteriores (cada uno inicia la suya): son varias
  await expect(page.getByText(/Contraseña cambiada\. Hemos cerrado (la otra sesión|las otras \d+ sesiones)/)).toBeVisible();
  cliente.clave = nueva;

  expect((await otro.post('/api/auth/refresh')).status()).toBe(401);
  await otro.dispose();
  // Esta sigue abierta
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Seguridad', exact: true })).toBeVisible();
});

test('se ven las sesiones abiertas y se pueden cerrar todas las demás', async ({ page, playwright }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  const otro = await otroNavegador(playwright);

  await page.goto('/perfil/seguridad');
  const sesiones = page.locator('li.sesion-item');
  await expect(sesiones.filter({ hasText: 'Este navegador' })).toHaveCount(1);
  expect(await sesiones.count()).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Cerrar todas las demás' }).click();
  await expect(page.getByText(/Hemos cerrado \d+ sesi/)).toBeVisible();
  await expect(sesiones).toHaveCount(1);
  expect((await otro.post('/api/auth/refresh')).status()).toBe(401);
  await otro.dispose();
});

test('el cliente activa la verificación en dos pasos, el login se la pide y la vuelve a quitar', async ({ page }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await page.goto('/perfil/seguridad');

  await page.getByRole('button', { name: 'Activar la verificación en dos pasos' }).click();
  await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible();
  const secreto = ((await page.getByTestId('secreto-totp').textContent()) ?? '').replace(/\s/g, '');
  await page.getByLabel('Código de verificación').fill(await codigoSinUsar(cliente.usuario, secreto));
  await page.getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(page.locator('ul.codigos li')).toHaveCount(10);
  await page.getByLabel('He guardado los códigos en un lugar seguro').check();
  await page.getByRole('button', { name: 'Hecho' }).click();
  // El indicador de la cabecera (en la pestaña, «Verificación en dos pasos» y «Activa» van por separado)
  await expect(cabecera(page).getByText('Verificación en dos pasos activa')).toBeVisible();
  await expect(page.getByText('Te quedan 10 códigos de recuperación sin usar.')).toBeVisible();

  // Desde ahora su login pasa por el segundo paso (iniciarSesion calcula el código con el secreto)
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await page.goto('/perfil/seguridad');
  await page.getByRole('button', { name: 'Desactivar' }).click();
  await page.locator('#modalConfirmar').getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText('Verificación en dos pasos desactivada.')).toBeVisible();
  await expect(cabecera(page).getByText('Verificación en dos pasos desactivada')).toBeVisible();
});
