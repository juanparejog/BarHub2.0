import { test, expect, ADMIN, iniciarSesion, filasConDatos, darDeAltaEmpleado } from './fixtures';

/**
 * Registro de jornada: el administrador da de alta a un empleado desde el panel, el empleado
 * entra (empieza su turno) y lo termina desde el menú, y el administrador lo ve en el registro.
 */
test.describe.configure({ mode: 'serial' });

const sufijo = Date.now().toString(36);
const empleado = { usuario: `emp_${sufijo}`, clave: `Turno${sufijo}A1` };

test('el administrador da de alta a un empleado desde el panel', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await darDeAltaEmpleado(page, empleado);
});

test('el empleado entra con la contraseña que le puso el administrador y termina su turno', async ({ page }) => {
  // Si la contraseña se hubiera guardado en claro, este login fallaría. Es su primer login: antes
  // de entrar configura la verificación en dos pasos (iniciarSesion lo hace como lo haría con su app)
  await iniciarSesion(page, empleado.usuario, empleado.clave);

  await page.locator('app-menu').getByRole('link', { name: /^Avatar/ }).click();
  await page.getByRole('link', { name: 'Terminar turno' }).click();

  const confirmacion = page.locator('#modalConfirmar');
  await expect(confirmacion).toBeVisible();
  await expect(confirmacion).toContainText('Entraste a las');
  await confirmacion.getByRole('button', { name: 'Aceptar' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/Turno terminado a las \d{2}:\d{2}/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('el administrador ve el turno terminado en el registro de jornada', async ({ page }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await page.goto('/admin/registro-jornada');

  const fila = filasConDatos(page).filter({ hasText: empleado.usuario });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('Terminado');
  await expect(page.locator('.resumen-empleado', { hasText: empleado.usuario })).toContainText('1 turno');
});
