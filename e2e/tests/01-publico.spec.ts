import { test, expect, avisoAlVisitar } from './fixtures';

test.describe('Visitante sin sesión', () => {
  test('la portada carga y el menú lleva a la carta', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
    await page.locator('app-menu').getByRole('link', { name: 'Carta', exact: true }).click();
    await expect(page).toHaveURL(/\/carta$/);
    await expect(page.getByRole('heading', { name: 'Carta Digital' })).toBeVisible();
  });

  test('la carta no deja añadir productos hasta indicar la modalidad', async ({ page }) => {
    await page.goto('/carta');
    const producto = page.locator('.product-card').first();
    const anadir = producto.getByRole('button', { name: 'Añadir' });
    await expect(producto.locator('.product-title')).not.toBeEmpty();
    await expect(anadir).toBeDisabled();

    await page.getByRole('button', { name: 'Para Recoger' }).click();
    await page.locator('#telefonoRecoger').fill('600000000');
    await expect(anadir).toBeEnabled();
    await anadir.click();
    await expect(page.locator('.cart-items-count')).toContainText('1');
  });

  test('las pantallas del personal y del administrador están cerradas', async ({ page }) => {
    for (const ruta of ['/admin', '/empleado/gestionar-comandas', '/empleado/gestionar-caja']) {
      expect(await avisoAlVisitar(page, ruta)).toContain('No tienes permisos');
      await expect(page).toHaveURL(/\/home$/);
    }
  });

  test('un login incorrecto no inicia sesión', async ({ page }) => {
    // Usuario inventado: no suma intentos fallidos a ninguna cuenta real
    await page.goto('/auth/login');
    await page.locator('input[formcontrolname="username"]').fill(`noexiste_${Date.now().toString(36)}`);
    await page.locator('input[formcontrolname="password"]').fill('ClaveIncorrecta1');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByText('Usuario o contraseña incorrectos')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});
