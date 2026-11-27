import { test, expect, ADMIN, iniciarSesion, crearClienteConfirmado } from './fixtures';

/**
 * Idiomas de las pantallas del cliente: se eligen en el menú, se recuerdan en el navegador y, la
 * primera vez, se toma el del navegador. Los textos cambian sin recargar; los nombres de los
 * productos (que vienen de la base de datos) no.
 */
type Pagina = import('@playwright/test').Page;
const NOMBRES = { es: 'Español', pt: 'Português', en: 'English' } as const;
/** Los botones con bandera del menú: cada uno se llama como su idioma. */
const elegirIdioma = (page: Pagina, idioma: keyof typeof NOMBRES) =>
  page.locator('app-selector-idioma').getByRole('button', { name: NOMBRES[idioma], exact: true }).click();
const idiomaMarcado = (page: Pagina) => page.locator('app-selector-idioma').locator('button[aria-pressed="true"]');

test('el visitante cambia la carta a inglés y a portugués, y la elección se recuerda', async ({ page }) => {
  await page.goto('/carta');
  await expect(page.getByRole('heading', { name: 'Carta Digital' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  // En español, el precio con la coma y el euro detrás
  await expect(page.locator('.product-price').first()).toHaveText(/^\d+,\d{2}\s€$/);

  await elegirIdioma(page, 'en');
  await expect(page.getByRole('heading', { name: 'Digital menu' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Takeaway' })).toBeVisible();
  await expect(page.locator('.product-price').first()).toHaveText(/^€\d+\.\d{2}$/);
  await expect(page.locator('.product-card').first().getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.locator('app-menu').getByRole('link', { name: 'Menu', exact: true })).toBeVisible();
  await expect(page.locator('app-footer').getByRole('link', { name: 'Privacy policy' })).toBeVisible();

  // Los alérgenos, con su nombre en inglés (también para el lector de pantalla)
  await page.getByText('Allergies and intolerances').click();
  await expect(page.getByRole('checkbox', { name: 'Milk', exact: true })).toBeVisible();

  // Al volver a entrar sigue en inglés
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Digital menu' })).toBeVisible();
  await expect(idiomaMarcado(page)).toHaveAttribute('lang', 'en');

  await elegirIdioma(page, 'pt');
  await expect(page.getByRole('heading', { name: 'Ementa digital' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  await expect(page.getByRole('button', { name: 'Para levantar' })).toBeVisible();
  await page.getByText('Alergias e intolerâncias').click();
  await expect(page.getByRole('checkbox', { name: 'Frutos de casca rija', exact: true })).toBeVisible();

  // Lo que falta por indicar, en portugués
  await expect(page.locator('.lock-warning-banner')).toContainText('escolha a sua mesa');

  // Se deja en español para los demás tests de este navegador
  await elegirIdioma(page, 'es');
  await expect(page.getByRole('heading', { name: 'Carta Digital' })).toBeVisible();
});

test.describe('con un navegador en portugués', () => {
  test.use({ locale: 'pt-PT' });

  test('la primera visita sale en portugués sin tocar nada', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
    await expect(page.getByRole('link', { name: 'Ver a ementa digital' })).toBeVisible();
    await expect(idiomaMarcado(page)).toHaveAttribute('lang', 'pt');
  });
});

test('inicio de sesión, registro y textos legales en inglés y en portugués', async ({ page }) => {
  await page.goto('/auth/login');
  await elegirIdioma(page, 'en');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await expect(page.getByText('Username', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgotten your password?' })).toBeVisible();

  await page.goto('/auth/register');
  await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toBeVisible();

  await page.goto('/terminos-condiciones');
  await expect(page.getByRole('heading', { name: 'Terms, conditions and legal notice' })).toBeVisible();
  await expect(page.getByText('These terms are governed entirely by')).toBeVisible();

  await elegirIdioma(page, 'pt');
  await page.goto('/politica-privacidad');
  await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
  await expect(page.getByText('aceder, retificar, apagar, limitar ou opor-se')).toBeVisible();
  await page.goto('/auth/recuperar');
  await expect(page.getByRole('heading', { name: 'Recuperar a palavra-passe' })).toBeVisible();
});

test('el perfil del cliente, con sus pestañas y sus sesiones, en inglés', async ({ page, request }) => {
  const cliente = await crearClienteConfirmado(request, 'idi');
  await iniciarSesion(page, cliente.usuario, cliente.clave);
  await elegirIdioma(page, 'en');
  await page.goto('/perfil/seguridad');

  const pestanas = page.getByRole('navigation', { name: 'Profile sections' });
  await expect(pestanas.getByRole('link', { name: 'Personal details' })).toBeVisible();
  await expect(pestanas.getByRole('link', { name: 'Security' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Open sessions' })).toBeVisible();
  await expect(page.getByText('This browser')).toBeVisible();
  await expect(page.getByText(/last active (just now|\d+ minutes? ago)/)).toBeVisible();
  await expect(page.getByText('Customer', { exact: true })).toBeVisible();

  await pestanas.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Download my data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
});

test('el nombre y la descripción de un producto salen en el idioma elegido si el bar los ha traducido', async ({ page, request }) => {
  await iniciarSesion(page, ADMIN.usuario, ADMIN.clave);
  const cabeceras = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` };
  const sufijo = Date.now().toString(36);
  const nombre = `Tortilla idiomas e2e ${sufijo}`;
  const alta = await request.post('/api/productos/', {
    headers: cabeceras,
    multipart: {
      producto: {
        name: 'producto.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          nombre, descripcion: 'Tortilla de patatas', precio: 3, tipoProducto: 'TAPA', alergenos: null,
          nombrePt: `Tortilha e2e ${sufijo}`, nombreEn: `Spanish omelette e2e ${sufijo}`, descripcionEn: 'Potato omelette'
        }))
      }
    }
  });
  expect(alta.ok(), await alta.text()).toBe(true);
  const id = (await alta.json()).id;

  try {
    await page.goto('/carta');
    const tarjeta = page.locator('.product-card', { has: page.locator('.product-title', { hasText: sufijo }) });
    await expect(tarjeta.locator('.product-title')).toHaveText(nombre);

    await elegirIdioma(page, 'en');
    await expect(tarjeta.locator('.product-title')).toHaveText(`Spanish omelette e2e ${sufijo}`);
    await expect(tarjeta).toContainText('Potato omelette');

    // Sin descripción en portugués: sale la de siempre
    await elegirIdioma(page, 'pt');
    await expect(tarjeta.locator('.product-title')).toHaveText(`Tortilha e2e ${sufijo}`);
    await expect(tarjeta).toContainText('Tortilla de patatas');
    await elegirIdioma(page, 'es');
  } finally {
    await request.delete(`/api/productos/${id}`, { headers: cabeceras, timeout: 15_000 });
  }
});
