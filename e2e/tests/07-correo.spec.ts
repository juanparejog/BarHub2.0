import { test, expect, iniciarSesion, enlaceDelCorreo, registrarYConfirmar } from './fixtures';

/**
 * Recuperar la contraseña: el enlace llega a Mailpit, la contraseña nueva sustituye a la vieja,
 * las sesiones abiertas se cierran y el enlace no sirve dos veces.
 */
test.describe.configure({ mode: 'serial' });

const sufijo = Date.now().toString(36);
const cliente = { usuario: `rec_${sufijo}`, clave: `Antigua${sufijo}A1`, email: `rec_${sufijo}@barhub.test` };
const nuevaClave = `Nueva${sufijo}B2`;

test('recuperar la contraseña con el enlace del correo cierra las sesiones abiertas', async ({ page, request, browser, baseURL }) => {
  await registrarYConfirmar(page, request, cliente);

  // Una sesion abierta en otro navegador (por ejemplo, un movil olvidado)
  const otroNavegador = await browser.newContext({ baseURL });
  const otraPagina = await otroNavegador.newPage();
  await iniciarSesion(otraPagina, cliente.usuario, cliente.clave);
  const cookieVieja = (await otroNavegador.cookies()).find(c => c.name === 'barhub_refresh')!;

  await page.goto('/auth/login');
  await page.getByRole('link', { name: '¿Has olvidado tu contraseña?' }).click();
  await expect(page).toHaveURL(/\/auth\/recuperar$/);
  await page.getByLabel('Correo electrónico').fill(cliente.email);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText(/Si hay una cuenta con ese correo/)).toBeVisible();

  const enlace = await enlaceDelCorreo(request, cliente.email, 'restablecer');
  await page.goto(enlace);
  await page.getByLabel('Contraseña nueva').fill(nuevaClave);
  await page.getByLabel('Repite la contraseña').fill(nuevaClave);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('Contraseña cambiada. Ya puedes iniciar sesión.')).toBeVisible();

  // La sesion del otro navegador ya no se puede renovar
  const renovar = await request.post('/api/auth/refresh', { headers: { Cookie: `barhub_refresh=${cookieVieja.value}` } });
  expect(renovar.status()).toBe(401);
  await otroNavegador.close();

  // El mismo enlace no sirve otra vez. Se sale antes de la pagina: desde /auth/restablecer, ir al
  // enlace solo cambiaria el fragmento y el navegador no la volveria a cargar
  await page.goto('/home');
  await page.goto(enlace);
  await page.getByLabel('Contraseña nueva').fill(`Otra${sufijo}C3`);
  await page.getByLabel('Repite la contraseña').fill(`Otra${sufijo}C3`);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('no es válido o ha caducado');
});

test('con la contraseña nueva se entra; con la vieja, no', async ({ page }) => {
  await page.goto('/auth/login');
  await page.locator('input[formcontrolname="username"]').fill(cliente.usuario);
  await page.locator('input[formcontrolname="password"]').fill(cliente.clave);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Usuario o contraseña incorrectos')).toBeVisible();

  await iniciarSesion(page, cliente.usuario, nuevaClave);
});

test('recuperar con un correo que no existe responde igual y no envía nada', async ({ page, request }) => {
  const inventado = `nadie_${sufijo}@barhub.test`;
  await page.goto('/auth/recuperar');
  await page.getByLabel('Correo electrónico').fill(inventado);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText(/Si hay una cuenta con ese correo/)).toBeVisible();

  // El correo sale en segundo plano: se le dan 2 s para llegar a Mailpit y, pasados, no tiene que haber ninguno.
  // Hasta entonces el sondeo devuelve -1 y sigue esperando; si llegara alguno, se quedaría en 1 y fallaría.
  const desde = Date.now();
  const recibidos = async () => {
    const busqueda = await request.get(`${process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'}/api/v1/search`,
      { params: { query: `to:"${inventado}"` } });
    return ((await busqueda.json()).messages ?? []).length;
  };
  await expect.poll(async () => (Date.now() - desde >= 2_000 ? recibidos() : -1),
    { timeout: 6_000, intervals: [500] }).toBe(0);
});
