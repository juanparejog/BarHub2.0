import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect, iniciarSesion, crearClienteConfirmado } from './fixtures';

/**
 * Pago con tarjeta con Stripe en modo de pruebas. Lo que no depende de Stripe se prueba siempre: el
 * servidor no da por pagado un pedido con tarjeta sin un pago real y, sin claves, la tarjeta no se
 * ofrece. El pago de verdad con las tarjetas de prueba de Stripe solo corre si el backend tiene las
 * claves de pruebas (STRIPE_SECRET_KEY y STRIPE_PUBLISHABLE_KEY en el .env); en CI no las hay.
 */
test.describe.configure({ mode: 'serial' });

interface Configuracion { tarjeta: boolean; clavePublica: string | null; pruebas: boolean }
interface Producto { id: number; nombre: string; precio: number }

let cliente: { usuario: string; clave: string; email: string };
let tokenCliente = '';
let configuracion: Configuracion;
let producto: Producto;

async function misPedidos(request: APIRequestContext, token: string): Promise<Array<Record<string, unknown>>> {
  const respuesta = await request.get('/api/pedidos/mis-pedidos', { headers: { Authorization: `Bearer ${token}` } });
  expect(respuesta.ok()).toBe(true);
  return respuesta.json();
}

/** Con la sesion del cliente: deja un carrito para recoger y abre la confirmacion del pedido. */
async function abrirConfirmacion(page: Page): Promise<void> {
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await page.evaluate(p => localStorage.setItem('pedidoTemporal', JSON.stringify({
    tipoPedido: 'RECOGER', telefonoContacto: '600000000',
    productos: [{ producto: p, cantidad: 2 }], precioTotal: p.precio * 2,
  })), producto);
  await page.goto('/confirmar-pedido');
  await expect(page.getByRole('heading', { name: 'Resumen del Pedido' })).toBeVisible();
}

/** Los tests bloquean los servicios de fuera; estos necesitan Stripe.js y su API. */
async function permitirStripe(page: Page): Promise<void> {
  await page.context().route(/^https:\/\/([a-z0-9-]+\.)*(stripe\.com|stripe\.network|stripecdn\.com)\//,
    ruta => ruta.continue());
}

async function escribirTarjeta(page: Page, numero: string): Promise<void> {
  await page.getByRole('radio', { name: 'Tarjeta de Crédito' }).check();
  const tarjeta = page.frameLocator('#card-element iframe').first();
  await tarjeta.locator('input[name="cardnumber"]').pressSequentially(numero);
  await tarjeta.locator('input[name="exp-date"]').pressSequentially('1234');
  await tarjeta.locator('input[name="cvc"]').pressSequentially('123');
}

test.beforeAll(async ({ request }) => {
  cliente = await crearClienteConfirmado(request, 'pago');
  const login = await request.post('/api/auth/login', { data: { username: cliente.usuario, password: cliente.clave } });
  expect(login.ok()).toBe(true);
  tokenCliente = (await login.json()).token;
  configuracion = await (await request.get('/api/pagos/configuracion')).json();
  const productos = (await (await request.get('/api/productos/')).json()) as Producto[];
  producto = productos.find(p => Number(p.precio) > 0)!;
  expect(producto, 'hace falta un producto con precio en la carta').toBeTruthy();
});

test('el servidor no da por pagado un pedido con tarjeta sin un pago cobrado en Stripe', async ({ request }) => {
  expect(JSON.stringify(configuracion), 'la configuración no lleva la clave secreta').not.toMatch(/sk_|rk_/);
  const cabeceras = { Authorization: `Bearer ${tokenCliente}` };
  const pedido = (extra: Record<string, unknown>) => ({
    tipo_pedido: 'RECOGER', telefono_contacto: '600000000', metodo_pago: 'TARJETA', estado_pago: 'COMPLETADO',
    detalles: [{ id_producto: producto.id, cantidad: 1 }], ...extra,
  });
  // Sin claves, la tarjeta no está disponible (503); con ellas, sin pago o con uno inventado, 400
  const rechazo = configuracion.tarjeta ? 400 : 503;

  const sinPago = await request.post('/api/pedidos', { headers: cabeceras, data: pedido({}) });
  expect(sinPago.status(), await sinPago.text()).toBe(rechazo);
  const inventado = await request.post('/api/pedidos', { headers: cabeceras, data: pedido({ pago_id: 'pi_inventado00000000' }) });
  expect(inventado.status(), await inventado.text()).toBe(rechazo);

  // En efectivo se crea, pero el cliente no puede darlo por pagado
  const efectivo = await request.post('/api/pedidos', { headers: cabeceras, data: pedido({ metodo_pago: 'EFECTIVO' }) });
  expect(efectivo.status()).toBe(201);
  expect((await efectivo.json()).estadoPago).toBe('PENDIENTE');
});

test('la tarjeta solo se puede elegir si el servidor tiene las claves de Stripe', async ({ page }) => {
  await abrirConfirmacion(page);
  const tarjeta = page.getByRole('radio', { name: 'Tarjeta de Crédito' });
  if (configuracion.tarjeta) {
    await expect(tarjeta).toBeEnabled();
  } else {
    await expect(tarjeta).toBeDisabled();
    await expect(page.getByText('El pago con tarjeta no está disponible ahora mismo.')).toBeVisible();
    // Se sigue pudiendo pedir en efectivo
    await expect(page.getByRole('radio', { name: 'Efectivo / TPV en Mesa' })).toBeChecked();
  }
});

test('pago con la tarjeta de pruebas 4242: el pedido queda pagado', async ({ page, request }) => {
  test.skip(!configuracion.tarjeta, 'sin claves de pruebas de Stripe en el backend');
  await permitirStripe(page);
  await abrirConfirmacion(page);
  await escribirTarjeta(page, '4242424242424242');
  await expect(page.getByText(/Modo de pruebas de Stripe/)).toBeVisible();

  const descarga = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Confirmar y Finalizar Pedido' }).click();
  const ticket = await descarga;
  const id = Number(/BH-(\d+)\.pdf$/.exec(ticket.suggestedFilename())?.[1]);
  await expect(page.getByText('¡Pedido realizado con éxito!')).toBeVisible();

  const pedido = (await misPedidos(request, tokenCliente)).find(p => p.id === id);
  expect(pedido, `pedido ${id} en mis pedidos`).toBeTruthy();
  expect(pedido!.estadoPago).toBe('COMPLETADO');
  expect(String(pedido!.metodoPago).toUpperCase()).toBe('TARJETA');
  expect(Number(pedido!.precioTotal ?? pedido!.precio_total)).toBeCloseTo(Number(producto.precio) * 2, 2);
});

test('una tarjeta rechazada no crea el pedido y se ve el motivo', async ({ page, request }) => {
  test.skip(!configuracion.tarjeta, 'sin claves de pruebas de Stripe en el backend');
  const antes = (await misPedidos(request, tokenCliente)).length;
  await permitirStripe(page);
  await abrirConfirmacion(page);
  // Tarjeta de pruebas de Stripe que siempre se rechaza
  await escribirTarjeta(page, '4000000000000002');

  await page.getByRole('button', { name: 'Confirmar y Finalizar Pedido' }).click();
  await expect(page.locator('.card-errors')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Confirmar y Finalizar Pedido' })).toBeEnabled();
  expect((await misPedidos(request, tokenCliente))).toHaveLength(antes);
});
