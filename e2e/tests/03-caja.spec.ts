import { test, expect, ADMIN, iniciarSesion } from './fixtures';

test('el personal abre la caja y la cierra con su arqueo', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await page.goto('/empleado/gestionar-caja');

  const abrir = page.getByRole('button', { name: 'Abrir Caja Diaria' });
  const cerrar = page.getByRole('button', { name: 'Cerrar Caja y Finalizar Turno' });
  await expect(abrir.or(cerrar)).toBeVisible();

  // Solo en local: si quedo una caja abierta de antes, se cierra primero
  if (await cerrar.isVisible()) {
    await page.locator('#efectivoRealInput').fill('0');
    await cerrar.click();
    await expect(abrir).toBeVisible();
  }

  await page.locator('#montoInicialInput').fill('100');
  await abrir.click();
  await expect(page.getByText(/Caja Actual #\d+/)).toBeVisible();

  await page.locator('#efectivoRealInput').fill('100');
  await cerrar.click();
  await expect(page.getByText('La caja se encuentra actualmente CERRADA')).toBeVisible();
  await expect(abrir).toBeVisible();
});
