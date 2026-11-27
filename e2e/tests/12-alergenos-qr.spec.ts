import { type APIRequestContext } from '@playwright/test';
import { test, expect, ADMIN, iniciarSesion } from './fixtures';

/**
 * Alérgenos en la carta y QR propio de las mesas. Crea por la API dos productos de prueba (uno con
 * alérgenos y otro sin indicarlos) y los borra al final, y también los que hubieran quedado de una
 * ejecución anterior que se cortó.
 */
const PREFIJOS = ['Croquetas e2e ', 'Pincho e2e '];

async function borrarProductosDePrueba(request: APIRequestContext, cabeceras: Record<string, string>): Promise<void> {
  const listado = await request.get('/api/productos/');
  if (!listado.ok()) {
    return;
  }
  for (const producto of (await listado.json()) as Array<{ id: number; nombre: string }>) {
    if (PREFIJOS.some(prefijo => producto.nombre.startsWith(prefijo))) {
      await request.delete(`/api/productos/${producto.id}`, { headers: cabeceras, timeout: 15_000 });
    }
  }
}

test('la carta muestra los iconos de los alérgenos, filtra por ellos y el QR de la mesa se dibuja sin servicios de fuera', async ({ page, request }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const cabeceras = { Authorization: `Bearer ${token}` };
  await borrarProductosDePrueba(request, cabeceras);

  const sufijo = Date.now().toString(36);
  const conAlergenos = `${PREFIJOS[0]}${sufijo}`;
  const sinIndicar = `${PREFIJOS[1]}${sufijo}`;
  const crear = async (nombre: string, alergenos: string[] | null) => {
    const respuesta = await request.post('/api/productos/', {
      headers: cabeceras,
      multipart: {
        producto: {
          name: 'producto.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({ nombre, descripcion: 'Producto de prueba', precio: 3, tipoProducto: 'TAPA', alergenos }))
        }
      }
    });
    expect(respuesta.ok(), await respuesta.text()).toBe(true);
  };
  await crear(conAlergenos, ['LACTEOS', 'GLUTEN']);
  await crear(sinIndicar, null);

  await page.goto('/carta');
  // La carta va por páginas: se buscan los dos productos de prueba por la parte común de su nombre
  await page.getByRole('searchbox', { name: 'Buscar en la carta' }).fill(sufijo);
  const tarjeta = (nombre: string) => page.locator('.product-card', { hasText: nombre });
  const iconos = tarjeta(conAlergenos).getByRole('list', { name: 'Alérgenos' }).getByRole('img');
  await expect(iconos).toHaveCount(2);
  await expect(iconos.nth(0)).toHaveAccessibleName('Gluten');
  await expect(iconos.nth(1)).toHaveAccessibleName('Lácteos');
  await expect(tarjeta(sinIndicar)).toContainText('Alérgenos: pregunta al personal');

  // Quien evita el gluten no ve lo que lo lleva ni lo que no tiene la información
  await page.getByText('Alergias e intolerancias').click();
  await expect(page.locator('details.filtro-alergenos')).toHaveAttribute('open', '');
  await page.getByRole('checkbox', { name: 'Gluten', exact: true }).check();
  await expect(tarjeta(conAlergenos)).toHaveCount(0);
  await expect(tarjeta(sinIndicar)).toHaveCount(0);
  await expect(page.getByText('porque aún no tienen la información de alérgenos')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar el filtro' }).click();
  await expect(tarjeta(conAlergenos)).toHaveCount(1);

  // QR de una mesa: imagen dibujada en el navegador con la dirección de esta web
  await page.goto('/empleado/gestionar-mesas');
  await page.getByRole('button', { name: /Ver QR de Mesa/ }).first().click();
  const qr = page.getByRole('img', { name: /Código QR de la mesa/ });
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.getByTestId('url-qr')).toHaveText(new RegExp(`^${new URL(page.url()).origin}/carta\\?mesa=\\d+$`));
  await expect(page.getByRole('link', { name: 'Descargar para imprimir' })).toHaveAttribute('download', /^barhub-mesa-\d+-qr\.png$/);

  // Sin try/finally: si algo falla arriba se ve ese error, y la próxima ejecución borra lo que quede
  await borrarProductosDePrueba(request, cabeceras);
});
