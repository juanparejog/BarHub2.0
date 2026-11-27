import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect, ADMIN, iniciarSesion, crearClienteConfirmado } from './fixtures';

/**
 * Tiempo real: las comandas, el seguimiento y las mesas se actualizan con los avisos del servidor
 * (Server-Sent Events), sin recargar la página. Sin conexión la pantalla vuelve a preguntar cada 5 s,
 * así que las esperas son de 4 s: si el cambio llega antes, ha llegado por el aviso.
 */
test.describe.configure({ mode: 'serial' });

const AL_MOMENTO = 4_000;
let cliente: { usuario: string; clave: string; email: string };
let tokenCliente = '';
let idPedido = 0;
let producto: { id: number; nombre: string; alergenos: string[] | null };

/** Abre una pantalla y espera a que quede conectada a los avisos. */
async function abrirConectada(page: Page, ruta: string, canal: 'personal' | 'mis-pedidos'): Promise<void> {
  const conexion = page.waitForResponse(r => r.url().includes(`/api/eventos/${canal}`));
  await page.goto(ruta);
  expect((await conexion).status()).toBe(200);
}

async function tokenDe(request: APIRequestContext, usuario: string, clave: string): Promise<string> {
  const login = await request.post('/api/auth/login', { data: { username: usuario, password: clave } });
  expect(login.ok(), `login de ${usuario}`).toBe(true);
  return (await login.json()).token as string;
}

test.beforeAll(async ({ request }) => {
  cliente = await crearClienteConfirmado(request, 'tr');
  tokenCliente = await tokenDe(request, cliente.usuario, cliente.clave);
  const productos = (await (await request.get('/api/productos/')).json()) as typeof producto[];
  expect(productos.length, 'hace falta al menos un producto en la carta').toBeGreaterThan(0);
  producto = productos[0];
});

test('los avisos son solo para quien corresponde: sin sesión 401 y el canal del personal no es para clientes', async ({ request }) => {
  expect((await request.get('/api/eventos/personal')).status()).toBe(401);
  expect((await request.get('/api/eventos/mis-pedidos')).status()).toBe(401);
  const comoCliente = await request.get('/api/eventos/personal', { headers: { Authorization: `Bearer ${tokenCliente}` } });
  expect(comoCliente.status()).toBe(403);
});

test('la comanda nueva aparece en la pantalla del personal sin recargar y se imprime en formato ticket', async ({ page, request }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  await abrirConectada(page, '/empleado/gestionar-comandas', 'personal');
  await expect(page.getByRole('heading', { name: /Pantalla de Comandas/ })).toBeVisible();

  const alta = await request.post('/api/pedidos', {
    headers: { Authorization: `Bearer ${tokenCliente}` },
    data: { tipo_pedido: 'RECOGER', telefono_contacto: '600000000', detalles: [{ id_producto: producto.id, cantidad: 2 }] },
  });
  expect(alta.status(), await alta.text()).toBe(201);
  idPedido = (await alta.json()).id;

  const comanda = page.locator('.comanda-kds-card').filter({
    has: page.locator('.pedido-num', { hasText: new RegExp(`#${idPedido}(?!\\d)`) }),
  });
  await expect(comanda).toBeVisible({ timeout: AL_MOMENTO });
  // Lo que oye quien usa lector de pantalla
  await expect(page.locator('.gestion-comandas-container output')).toHaveText(`Nueva comanda: pedido ${idPedido}`);

  // La impresión: se sustituye el diálogo del navegador y se mira la página como la imprimiría
  await page.evaluate(() => {
    (window as any).__impresiones = 0;
    window.print = () => { (window as any).__impresiones++; };
  });
  await comanda.getByRole('button', { name: `Imprimir comanda del pedido ${idPedido}` }).click();
  expect(await page.evaluate(() => (window as any).__impresiones)).toBe(1);

  await page.emulateMedia({ media: 'print' });
  const ticket = page.locator('.ticket-comanda');
  await expect(ticket).toBeVisible();
  await expect(comanda).toBeHidden();
  await expect(ticket).toContainText(`COMANDA #${idPedido}`);
  await expect(ticket).toContainText('Recoger en Tienda');
  await expect(ticket).toContainText(`2 x ${producto.nombre}`);
  if (producto.alergenos === null) {
    await expect(ticket).toContainText('Alérgenos: sin indicar, consultar');
  } else if (producto.alergenos.length > 0) {
    await expect(ticket).toContainText('Alérgenos:');
  }

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await expect(ticket).toHaveCount(0);
  await expect(comanda).toBeVisible();
});

test('el cliente ve en su seguimiento el cambio de estado al momento', async ({ page, browser }) => {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await abrirConectada(page, '/seguimiento-pedidos', 'mis-pedidos');
  const tarjeta = page.locator('.pedido-card').filter({
    has: page.locator('.pedido-badge-id', { hasText: new RegExp(`Pedido #${idPedido}(?!\\d)`) }),
  });
  const pasoListo = tarjeta.locator('.tracker-step', { hasText: 'Listo para recoger' });
  await expect(tarjeta).toBeVisible();
  await expect(pasoListo).not.toHaveClass(/\bactive\b/);

  // El personal la marca como lista en su pantalla (otro navegador)
  const personal = await browser.newContext();
  const pantalla = await personal.newPage();
  await iniciarSesion(pantalla, ADMIN.usuario, ADMIN.clave);
  await pantalla.goto('/empleado/gestionar-comandas');
  const comanda = pantalla.locator('.comanda-kds-card').filter({
    has: pantalla.locator('.pedido-num', { hasText: new RegExp(`#${idPedido}(?!\\d)`) }),
  });
  await comanda.getByRole('button', { name: 'Listo p/ Recoger' }).click();
  await expect(comanda.locator('.badge-status')).toContainText('Listo p/ Recoger');
  await personal.close();

  await expect(pasoListo).toHaveClass(/\bactive\b/, { timeout: AL_MOMENTO });
});

test('un empleado cambia el estado de una mesa y las demás pantallas lo ven sin recargar', async ({ page, context, request }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  const tokenAdmin = await page.evaluate(() => localStorage.getItem('token'));
  const mesas = (await (await request.get('/api/mesas/', { headers: { Authorization: `Bearer ${tokenAdmin}` } })).json()) as
    Array<{ id: number; codigoqr: string | null; estado: string }>;
  expect(mesas.length, 'hace falta al menos una mesa').toBeGreaterThan(0);
  const mesa = mesas[0];
  const original = String(mesa.estado).toUpperCase();
  const nuevo = original === 'OCUPADA' ? 'RESERVADA' : 'OCUPADA';

  // El cliente no puede cambiar mesas
  const comoCliente = await request.patch(`/api/mesas/${mesa.id}/estado`, {
    headers: { Authorization: `Bearer ${tokenCliente}` }, data: { estado: nuevo },
  });
  expect(comoCliente.status()).toBe(403);

  await abrirConectada(page, '/empleado/gestionar-mesas', 'personal');
  const otra = await context.newPage();
  await abrirConectada(otra, '/empleado/gestionar-mesas', 'personal');
  const tarjeta = (p: Page) => p.locator('.mesa-card', {
    has: p.locator('.mesa-numero', { hasText: new RegExp(`Mesa #${mesa.codigoqr || mesa.id}$`) }),
  });

  const cambio = page.waitForResponse(r => r.url().endsWith(`/api/mesas/${mesa.id}/estado`) && r.request().method() === 'PATCH');
  await tarjeta(page).getByRole('button', { name: nuevo === 'OCUPADA' ? 'Ocupada' : 'Reservada' }).click();
  expect((await cambio).status()).toBe(200);
  await expect(tarjeta(otra)).toHaveClass(new RegExp(`estado-${nuevo.toLowerCase()}`), { timeout: AL_MOMENTO });

  // Se deja como estaba
  const vuelta = await request.patch(`/api/mesas/${mesa.id}/estado`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` }, data: { estado: original },
  });
  expect(vuelta.ok()).toBe(true);
  await expect(tarjeta(otra)).toHaveClass(new RegExp(`estado-${original.toLowerCase()}`), { timeout: AL_MOMENTO });
  await otra.close();
});
