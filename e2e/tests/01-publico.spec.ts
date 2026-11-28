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
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Usuario o contraseña incorrectos')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('la web lleva una CSP estricta y un script inyectado no se ejecuta', async ({ page, violacionesCsp }) => {
    const respuesta = await page.goto('/home');
    const csp = respuesta?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    for (const directiva of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", 'report-uri /api/csp-informe']) {
      expect(csp).toContain(directiva);
    }

    // Como lo haría un XSS: un <script> metido en la página no llega a ejecutarse
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inyectado = true';
      document.body.appendChild(script);
    });
    await expect.poll(() => violacionesCsp.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as unknown as { __inyectado?: boolean }).__inyectado)).toBeUndefined();
    expect(violacionesCsp[0]).toMatch(/^script-src(-elem)?: inline/);
    violacionesCsp.length = 0;
  });

  test('las fuentes y los iconos se sirven desde la propia web, sin Google Fonts', async ({ page }) => {
    const respuesta = await page.goto('/home');
    const csp = respuesta?.headers()['content-security-policy'] ?? '';
    expect(csp).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(csp).toContain("font-src 'self'");
    // Los tests bloquean todo lo que no es de la propia web: si una fuente se carga, es nuestra
    for (const fuente of ['16px "Inter Variable"', '700 16px "Merriweather Variable"', '24px "Material Icons"', '16px "bootstrap-icons"']) {
      const cargadas = await page.evaluate(async f => (await document.fonts.load(f)).length, fuente);
      expect(cargadas, `fuente ${fuente}`).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter Variable');
  });
});
