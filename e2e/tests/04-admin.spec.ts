import { test, expect, ADMIN, iniciarSesion } from './fixtures';

test('panel de administración, listados y métricas', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();

  const listados: Array<[string, string]> = [
    ['/admin/gestionar-productos', 'Productos'],
    ['/admin/gestionar-usuarios', 'Gestión de Usuarios'],
  ];
  for (const [ruta, titulo] of listados) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
    await expect(page.locator('table.crud-table tbody tr').first()).toBeVisible();
  }
  // Los roles llegan con el usuario (carga perezosa resuelta en el backend)
  await expect(page.locator('table.crud-table tbody tr', { hasText: ADMIN.usuario }).first()).toBeVisible();

  await page.goto('/admin/metricas');
  await expect(page.getByRole('heading', { name: /Panel de Métricas/ })).toBeVisible();
});
