import { test, expect, ADMIN, iniciarSesion, crearClienteConfirmado, filasConDatos } from './fixtures';

/**
 * Registro de auditoría: un login fallido y un acceso denegado quedan anotados con su resultado y
 * su petición, y el administrador los encuentra filtrando por usuario y acción.
 */
test('el administrador ve en la auditoría un login fallido y un acceso denegado', async ({ page, request }) => {
  const inventado = `aud_${Date.now().toString(36)}`;
  const fallido = await request.post('/api/auth/login', { data: { username: inventado, password: 'NoEsEsta1' } });
  expect(fallido.status()).toBe(401);

  // Un cliente con sesión que intenta leer la auditoría
  const cliente = await crearClienteConfirmado(request, 'aud');
  const login = await request.post('/api/auth/login', { data: { username: cliente.usuario, password: cliente.clave } });
  const token = (await login.json()).token as string;
  const denegado = await request.get('/api/auditoria', { headers: { Authorization: `Bearer ${token}` } });
  expect(denegado.status()).toBe(403);

  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await page.goto('/admin/auditoria');
  await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible();
  const filas = filasConDatos(page);

  await page.getByLabel('Usuario', { exact: true }).fill(inventado);
  await page.getByLabel('Acción', { exact: true }).selectOption({ label: 'Inicio de sesión' });
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText('Rechazado');
  await expect(filas.first()).toContainText('POST /auth/login');

  await page.getByLabel('Usuario', { exact: true }).fill(cliente.usuario);
  await page.getByLabel('Acción', { exact: true }).selectOption({ label: 'Acceso denegado' });
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText('GET /auditoria');
});
