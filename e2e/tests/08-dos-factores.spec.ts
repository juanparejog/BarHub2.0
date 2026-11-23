import {
  test, expect, ADMIN, iniciarSesion, darDeAltaEmpleado, codigoSinUsar, codigoTotp, cuentaTotp, guardarCuenta,
  filasConDatos
} from './fixtures';

/**
 * Verificación en dos pasos: un empleado nuevo no entra hasta configurar la app de autenticación;
 * después, sin el móvil, entra con un código de recuperación que solo sirve una vez; y si lo pierde
 * todo, el administrador se la restablece y la vuelve a configurar.
 */
test.describe.configure({ mode: 'serial' });

const sufijo = Date.now().toString(36);
const empleado = { usuario: `dosf_${sufijo}`, clave: `Dosf${sufijo}A1` };

async function escribirContrasena(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('input[formcontrolname="username"]').fill(empleado.usuario);
  await page.locator('input[formcontrolname="password"]').fill(empleado.clave);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/2fa$/);
}

test('el administrador da de alta al empleado', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await darDeAltaEmpleado(page, empleado);
});

test('el empleado no entra hasta configurar la app y guardar los códigos de recuperación', async ({ page }) => {
  await escribirContrasena(page);
  await expect(page.getByRole('heading', { name: 'Activa la verificación en dos pasos' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

  const secreto = ((await page.getByTestId('secreto-totp').textContent()) ?? '').replace(/\s/g, '');
  expect(secreto).toMatch(/^[A-Z2-7]{32}$/);

  // Un código que no es el de la app no la activa
  const correcto = codigoTotp(secreto, Math.floor(Date.now() / 30_000));
  await page.locator('#codigo2fa').fill(String((Number(correcto) + 500_000) % 1_000_000).padStart(6, '0'));
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByRole('alert')).toContainText('Código incorrecto');

  await page.locator('#codigo2fa').fill(await codigoSinUsar(empleado.usuario, secreto));
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByRole('heading', { name: 'Guarda tus códigos de recuperación' })).toBeVisible();
  const codigos = (await page.locator('ul.codigos li').allTextContents()).map(c => c.trim());
  expect(codigos).toHaveLength(10);
  for (const codigo of codigos) {
    expect(codigo).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  }
  guardarCuenta(empleado.usuario, { codigosRecuperacion: codigos });

  const continuar = page.getByRole('button', { name: 'Continuar' });
  await expect(continuar).toBeDisabled();
  await page.getByLabel('He guardado los códigos en un lugar seguro').check();
  await continuar.click();
  await expect(page).toHaveURL(/\/carta$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
});

test('sin el móvil entra con un código de recuperación, que no sirve dos veces', async ({ page }) => {
  const codigo = cuentaTotp(empleado.usuario)!.codigosRecuperacion![0];

  await escribirContrasena(page);
  await expect(page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Usa un código de recuperación/ }).click();
  await page.locator('#codigo2fa').fill(codigo.toLowerCase());
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: 'Has entrado con un código de recuperación' })).toBeVisible();
  await expect(page.getByText('Te quedan 9 códigos de recuperación sin usar.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/carta$/);

  await escribirContrasena(page);
  await page.getByRole('button', { name: /Usa un código de recuperación/ }).click();
  await page.locator('#codigo2fa').fill(codigo);
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('alert')).toContainText('Código incorrecto');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('el administrador le restablece la verificación y el empleado tiene que configurarla de nuevo', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await page.goto('/admin/gestionar-usuarios');
  const fila = filasConDatos(page).filter({ hasText: empleado.usuario });
  await expect(fila).toContainText('Activa');

  // Acaba de iniciar sesión: no se le vuelve a pedir el código para esta acción protegida
  await fila.getByRole('button', { name: 'Restablecer verificación en dos pasos' }).click();
  const confirmacion = page.locator('#modalConfirmar');
  await expect(confirmacion).toContainText(empleado.usuario);
  await confirmacion.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText(`Verificación en dos pasos de ${empleado.usuario} restablecida`)).toBeVisible();
  await expect(fila).not.toContainText('Activa');
  await expect(fila.getByRole('button', { name: 'Restablecer verificación en dos pasos' })).toHaveCount(0);

  await escribirContrasena(page);
  await expect(page.getByRole('heading', { name: 'Activa la verificación en dos pasos' })).toBeVisible();
});
