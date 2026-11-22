import { test, expect, ADMIN, iniciarSesion, avisoAlVisitar, filasConDatos } from './fixtures';

/**
 * Recorrido completo de un pedido: un cliente nuevo se registra, pide para recoger y descarga
 * el ticket; el personal ve la comanda y cambia su estado; el administrador la ve en el listado.
 * Los pasos dependen unos de otros, asi que van en serie.
 */
test.describe.configure({ mode: 'serial' });

const sufijo = Date.now().toString(36);
const cliente = {
  usuario: `e2e_${sufijo}`,
  clave: `E2e${sufijo}Aa1`,
  email: `e2e_${sufijo}@barhub.test`,
};
let idPedido = '';

test('registro: crea la cuenta y entra en la carta con la sesión iniciada', async ({ page }) => {
  await page.goto('/auth/register');
  await page.getByPlaceholder('Usuario', { exact: true }).fill(cliente.usuario);
  await page.getByPlaceholder('Nombre', { exact: true }).fill('Prueba');
  await page.getByPlaceholder('Primer apellido', { exact: true }).fill('E2E');
  await page.getByPlaceholder('Correo electrónico', { exact: true }).fill(cliente.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(cliente.clave);
  await page.getByPlaceholder('Repite tu contraseña', { exact: true }).fill(cliente.clave);
  await page.locator('input[name="politicas"]').check();
  await page.getByRole('button', { name: 'Registrarse' }).click();

  await expect(page).toHaveURL(/\/carta$/);
  // El registro inicia sesion con AuthService, que guarda el usuario en 'user'
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('user') ?? '{}').username))
    .toBe(cliente.usuario);
});

test('pedido para recoger: se confirma, se descarga el ticket y aparece en el seguimiento', async ({ page }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);

  await page.getByRole('button', { name: 'Para Recoger' }).click();
  await page.locator('#telefonoRecoger').fill('600000000');
  const producto = page.locator('.product-card').first();
  const nombre = (await producto.locator('.product-title').innerText()).trim();
  await producto.getByRole('button', { name: 'Añadir' }).click();
  await producto.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.locator('.cart-items-count')).toContainText('2');

  await page.getByRole('button', { name: 'Confirmar Pedido' }).click();
  await expect(page).toHaveURL(/\/confirmar-pedido$/);
  await expect(page.getByText(nombre).first()).toBeVisible();

  // El ticket en PDF se genera con pdfmake, que se carga bajo demanda con import()
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Confirmar y Finalizar Pedido' }).click();
  const ticket = await descarga;
  const coincidencia = /^ticket_BarHub_BH-(\d+)\.pdf$/.exec(ticket.suggestedFilename());
  expect(coincidencia, `nombre del ticket: ${ticket.suggestedFilename()}`).not.toBeNull();
  idPedido = coincidencia![1];
  await expect(page.getByText('¡Pedido realizado con éxito!')).toBeVisible();

  await page.goto('/seguimiento-pedidos');
  // Sin anclar al final: los iconos de Bootstrap Icons (::before) cuentan como texto en Playwright.
  // (?!\d) evita confundir el #3 con el #30
  await expect(page.locator('.pedido-badge-id', { hasText: new RegExp(`Pedido #${idPedido}(?!\\d)`) })).toBeVisible();
});

test('el cliente no puede entrar en las pantallas del personal', async ({ page }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  expect(await avisoAlVisitar(page, '/empleado/gestionar-comandas')).toContain('No tienes permisos');
  await expect(page).toHaveURL(/\/home$/);
});

test('el personal ve la comanda y la marca como lista para recoger', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await page.goto('/empleado/gestionar-comandas');

  const comanda = page.locator('.comanda-kds-card').filter({
    has: page.locator('.pedido-num', { hasText: new RegExp(`#${idPedido}(?!\\d)`) }),
  });
  await expect(comanda).toBeVisible();
  await expect(comanda.locator('.badge-status')).toContainText('En Cocina');

  await comanda.getByRole('button', { name: 'Listo p/ Recoger' }).click();
  await expect(comanda.locator('.badge-status')).toContainText('Listo p/ Recoger');

  // El cambio queda guardado en el servidor
  await page.reload();
  await expect(comanda.locator('.badge-status')).toContainText('Listo p/ Recoger');
});

test('el administrador ve los pedidos con su detalle en la gestión de pedidos', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await page.goto('/admin/gestionar-pedidos');
  await expect(page.getByRole('heading', { name: 'Gestión de Pedidos' })).toBeVisible();
  await expect(filasConDatos(page).first()).toBeVisible();
});
