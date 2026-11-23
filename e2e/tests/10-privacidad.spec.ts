import { readFileSync } from 'node:fs';
import { type APIRequestContext } from '@playwright/test';
import { test, expect, iniciarSesion, crearClienteConfirmado, enlaceDelCorreo } from './fixtures';

/**
 * Cuenta y privacidad desde el perfil: cambiar el correo (con el enlace que llega al nuevo y el aviso
 * al anterior), cancelar un cambio pendiente, descargar los datos y eliminar la cuenta.
 * Cada test usa su propio cliente: el backend no envía más de un enlace por minuto a la misma cuenta.
 * Todos entran justo antes, así que las acciones protegidas no piden confirmar de nuevo quién es.
 */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/** Espera a que {@code email} reciba un correo con ese asunto. */
async function esperarCorreo(request: APIRequestContext, email: string, asunto: string): Promise<void> {
  await expect.poll(async () => {
    const busqueda = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"` } });
    if (!busqueda.ok()) {
      return false;
    }
    return ((await busqueda.json()).messages ?? []).some((m: { Subject?: string }) => m.Subject === asunto);
  }, { message: `correo «${asunto}» para ${email} en Mailpit`, timeout: 20_000 }).toBe(true);
}

function correoNuevo(cliente: { usuario: string }): string {
  return `${cliente.usuario}.nuevo@barhub.test`;
}

test('el correo nuevo no entra hasta abrir el enlace, y al anterior se le avisa', async ({ page, request }) => {
  const cliente = await crearClienteConfirmado(request, 'e2ec');
  const nuevo = correoNuevo(cliente);
  await iniciarSesion(page, cliente.usuario, cliente.clave);

  await page.goto('/perfil/datos');
  await page.getByRole('link', { name: 'Cambiar', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil\/cuenta$/);
  await page.getByLabel('Correo nuevo').fill(nuevo);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText(`Te hemos enviado un enlace a ${nuevo}`)).toBeVisible();
  await expect(page.getByTestId('cambio-pendiente')).toContainText(nuevo);
  await expect(page.getByTestId('correo-actual')).toHaveText(cliente.email);
  await esperarCorreo(request, cliente.email, 'Se ha pedido cambiar el correo de tu cuenta de BarHub');

  const enlace = await enlaceDelCorreo(request, nuevo, 'confirmar-cambio-correo');
  await page.goto(enlace);
  await expect(page.getByText(`Listo: tu cuenta usa ahora ${nuevo}.`)).toBeVisible();
  await page.getByRole('link', { name: 'Ir a mi perfil' }).click();
  await expect(page.getByTestId('correo-actual')).toHaveText(nuevo);
  await expect(page.getByTestId('cambio-pendiente')).toHaveCount(0);
  await esperarCorreo(request, cliente.email, 'El correo de tu cuenta de BarHub ha cambiado');

  // El enlace no sirve dos veces
  await page.goto(enlace);
  await expect(page.getByText('El enlace no es válido o ha caducado. Pide uno nuevo.')).toBeVisible();
});

test('cancelar el cambio pendiente deja el enlace sin efecto', async ({ page, request }) => {
  const cliente = await crearClienteConfirmado(request, 'e2ec');
  const nuevo = correoNuevo(cliente);
  await iniciarSesion(page, cliente.usuario, cliente.clave);

  await page.goto('/perfil/cuenta');
  await page.getByLabel('Correo nuevo').fill(nuevo);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByTestId('cambio-pendiente')).toContainText(nuevo);
  await page.getByRole('button', { name: 'Cancelar el cambio' }).click();
  await expect(page.getByText('Cambio de correo cancelado: el enlace enviado ya no sirve.')).toBeVisible();
  await expect(page.getByTestId('cambio-pendiente')).toHaveCount(0);

  await page.goto(await enlaceDelCorreo(request, nuevo, 'confirmar-cambio-correo'));
  await expect(page.getByText('El enlace no es válido o ha caducado. Pide uno nuevo.')).toBeVisible();
  await page.goto('/perfil/cuenta');
  await expect(page.getByTestId('correo-actual')).toHaveText(cliente.email);
});

test('descargar mis datos baja un JSON con la cuenta y sin la contraseña', async ({ page, request }) => {
  const cliente = await crearClienteConfirmado(request, 'e2ec');
  await iniciarSesion(page, cliente.usuario, cliente.clave);

  await page.goto('/perfil/privacidad');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar mis datos' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^barhub-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);

  const contenido = readFileSync(await archivo.path(), 'utf-8');
  const datos = JSON.parse(contenido);
  expect(datos.cuenta.usuario).toBe(cliente.usuario);
  expect(datos.cuenta.correo).toBe(cliente.email);
  expect(datos.sesiones.length).toBeGreaterThan(0);
  expect(contenido).not.toContain(cliente.clave);
  expect(contenido.toLowerCase()).not.toContain('password');
});

test('eliminar la cuenta cierra la sesión y ya no se puede entrar', async ({ page, request }) => {
  const cliente = await crearClienteConfirmado(request, 'e2ec');
  await iniciarSesion(page, cliente.usuario, cliente.clave);

  await page.goto('/perfil/privacidad');
  const eliminar = page.getByRole('button', { name: 'Eliminar mi cuenta' });
  await expect(eliminar).toBeDisabled();
  await page.getByLabel(/Escribe tu nombre de usuario/).fill(cliente.usuario);
  await expect(eliminar).toBeEnabled();
  await eliminar.click();

  await expect(page).toHaveURL(/\/home$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await esperarCorreo(request, cliente.email, 'Tu cuenta de BarHub se ha eliminado');

  const login = await request.post('/api/auth/login', { data: { username: cliente.usuario, password: cliente.clave } });
  expect(login.status()).toBe(401);
});
