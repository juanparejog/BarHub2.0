import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { comprobarClaveTotp } from '../global-setup';

/** Administrador creado por DemoDataSeeder (APP_SEED_ADMIN_USERNAME y APP_SEED_ADMIN_PASSWORD). */
export const ADMIN = {
  usuario: process.env.E2E_ADMIN_USER ?? 'admin',
  get clave(): string {
    const clave = process.env.E2E_ADMIN_PASSWORD;
    if (!clave) {
      throw new Error('Define E2E_ADMIN_PASSWORD con la contraseña del administrador para los tests del personal.');
    }
    return clave;
  },
};

/**
 * En cada test:
 * - falla si la pagina lanza un error de JavaScript no capturado (por ejemplo, una app que no arranca);
 * - solo se permiten peticiones a la propia aplicacion. Stripe, Google Maps y Google Fonts se bloquean
 *   para que el resultado no dependa de servicios de terceros.
 */
export const test = base.extend<{ erroresPagina: string[] }>({
  erroresPagina: [
    async ({ page, baseURL }, use) => {
      const errores: string[] = [];
      page.on('pageerror', (error) => errores.push(error.message));
      const propio = new URL(baseURL ?? 'http://localhost').host;
      await page.context().route('**/*', (ruta) =>
        new URL(ruta.request().url()).host === propio ? ruta.continue() : ruta.abort(),
      );
      await use(errores);
      expect(errores, 'errores de JavaScript en la página').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Filas con datos de las tablas de gestion. Mientras carga, o si no hay datos, la tabla muestra una
 * sola celda con el aviso ("No hay usuarios...") que tambien es una fila: esa no cuenta.
 */
export function filasConDatos(page: Page) {
  return page.locator('table.crud-table tbody tr:has(td + td)');
}

/**
 * Login desde el formulario. El administrador y los empleados pasan ademas por la verificacion en
 * dos pasos: si aun no la tienen, se configura aqui (como lo haria el usuario con su app) y el
 * secreto se guarda en e2e/.auth/totp.json para los siguientes logins.
 */
export async function iniciarSesion(page: Page, usuario: string, clave: string): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('input[formcontrolname="username"]').fill(usuario);
  await page.locator('input[formcontrolname="password"]').fill(clave);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/(carta|auth\/2fa)$/);
  if (page.url().endsWith('/auth/2fa')) {
    await pasarSegundoPaso(page, usuario);
  }
  await expect(page).toHaveURL(/\/carta$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
}

// ---------- verificacion en dos pasos (TOTP) ----------

/** Secretos TOTP de los usuarios de los tests y el ultimo paso usado. No se sube al repositorio. */
const ARCHIVO_TOTP = resolve(__dirname, '..', '.auth', 'totp.json');

interface CuentaTotp {
  secreto: string;
  ultimoPaso?: number;
  codigosRecuperacion?: string[];
}

function leerCuentas(): Record<string, CuentaTotp> {
  return existsSync(ARCHIVO_TOTP) ? JSON.parse(readFileSync(ARCHIVO_TOTP, 'utf-8')) : {};
}

export function guardarCuenta(usuario: string, cambios: Partial<CuentaTotp>): void {
  const cuentas = leerCuentas();
  cuentas[usuario] = { ...cuentas[usuario], ...cambios } as CuentaTotp;
  mkdirSync(dirname(ARCHIVO_TOTP), { recursive: true });
  writeFileSync(ARCHIVO_TOTP, JSON.stringify(cuentas, null, 2), { mode: 0o600 });
}

/** Cuenta TOTP de un usuario. La del administrador puede venir de E2E_ADMIN_TOTP_SECRET. */
export function cuentaTotp(usuario: string): CuentaTotp | undefined {
  const guardada = leerCuentas()[usuario];
  const delEntorno = usuario === ADMIN.usuario ? process.env.E2E_ADMIN_TOTP_SECRET : undefined;
  return delEntorno ? { ...guardada, secreto: comprobarClaveTotp(delEntorno) } : guardada;
}

function base32(texto: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of texto.replace(/[\s=]/g, '').toUpperCase()) {
    const valor = alfabeto.indexOf(c);
    if (valor < 0) {
      throw new Error(`Secreto TOTP no válido: contiene "${c}"`);
    }
    bits += valor.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map(b => parseInt(b, 2)));
}

/** Codigo TOTP (RFC 6238: HMAC-SHA1, 30 segundos, 6 digitos), como el de la app del movil. */
export function codigoTotp(secreto: string, paso: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hash = createHmac('sha1', base32(secreto)).update(contador).digest();
  const inicio = hash[hash.length - 1] & 0x0f;
  return String((hash.readUInt32BE(inicio) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/**
 * Codigo de un paso de 30 segundos que aun no se ha usado: el servidor no acepta dos veces el
 * mismo, asi que dos logins seguidos del mismo usuario esperan al paso siguiente.
 */
export async function codigoSinUsar(usuario: string, secreto: string): Promise<string> {
  const ultimo = cuentaTotp(usuario)?.ultimoPaso ?? -1;
  let paso = Math.floor(Date.now() / 30_000);
  if (paso <= ultimo) {
    paso = ultimo + 1;
    const espera = paso * 30_000 - Date.now() + 500;
    // La espera no es culpa del test: se le suma a su tiempo maximo
    test.info().setTimeout(test.info().timeout + espera);
    await new Promise(resolve => setTimeout(resolve, espera));
  }
  guardarCuenta(usuario, { secreto, ultimoPaso: paso });
  return codigoTotp(secreto, paso);
}

async function pasarSegundoPaso(page: Page, usuario: string): Promise<void> {
  const activar = page.getByRole('heading', { name: 'Activa la verificación en dos pasos' });
  const verificar = page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true });
  await expect(activar.or(verificar)).toBeVisible();
  // Mientras falta el segundo paso no hay sesion
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

  if (await activar.isVisible()) {
    await configurarSegundoPaso(page, usuario);
    return;
  }

  const secreto = cuentaTotp(usuario)?.secreto;
  if (!secreto) {
    throw new Error(`${usuario} ya tiene la verificación en dos pasos y los tests no conocen su secreto. `
      + (usuario === ADMIN.usuario ? 'Define E2E_ADMIN_TOTP_SECRET con la clave que mostró al configurarla.' : ''));
  }
  // Un reintento por si el codigo de este paso ya se habia usado fuera de los tests
  const incorrecto = page.getByText('Código incorrecto');
  for (let intento = 1; intento <= 2; intento++) {
    await page.locator('#codigo2fa').fill(await codigoSinUsar(usuario, secreto));
    await page.getByRole('button', { name: 'Verificar' }).click();
    let resultado = '';
    await expect.poll(async () => {
      resultado = page.url().endsWith('/carta') ? 'dentro' : (await incorrecto.isVisible()) ? 'incorrecto' : '';
      return resultado;
    }, { message: 'respuesta al código TOTP' }).not.toBe('');
    if (resultado === 'dentro') {
      return;
    }
  }
  throw new Error(`El código TOTP de ${usuario} no es válido: revisa el secreto (E2E_ADMIN_TOTP_SECRET) y la hora del equipo.`);
}

/** Primera vez: lee la clave de la pantalla, activa con el primer codigo y guarda los de recuperacion. */
async function configurarSegundoPaso(page: Page, usuario: string): Promise<void> {
  const secreto = ((await page.getByTestId('secreto-totp').textContent()) ?? '').replace(/\s/g, '');
  expect(secreto, 'clave TOTP en la pantalla').toMatch(/^[A-Z2-7]{32}$/);
  guardarCuenta(usuario, { secreto, ultimoPaso: undefined, codigosRecuperacion: undefined });

  await page.locator('#codigo2fa').fill(await codigoSinUsar(usuario, secreto));
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByRole('heading', { name: 'Guarda tus códigos de recuperación' })).toBeVisible();
  const codigos = (await page.locator('ul.codigos li').allTextContents()).map(c => c.trim());
  expect(codigos).toHaveLength(10);
  guardarCuenta(usuario, { codigosRecuperacion: codigos });

  await page.getByLabel('He guardado los códigos en un lugar seguro').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

/**
 * Visita una ruta protegida y devuelve el aviso que muestra RoleGuard al denegar el acceso.
 * El aviso se acepta en cuanto aparece: si se esperase a que termine la navegacion, el alert
 * bloquearia la pagina y la carga no acabaria nunca.
 */
export async function avisoAlVisitar(page: Page, ruta: string): Promise<string> {
  let mensaje = '';
  page.once('dialog', async (dialogo) => {
    mensaje = dialogo.message();
    await dialogo.accept();
  });
  await page.goto(ruta);
  await expect.poll(() => mensaje).not.toBe('');
  return mensaje;
}

/** Bandeja de Mailpit, que captura los correos del backend en local y en el CI. */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/**
 * Enlace del ultimo correo recibido por {@code email} que lleve a {@code ruta}
 * ('verificar' o 'restablecer'), como ruta relativa lista para page.goto(). El correo se envia en
 * segundo plano, asi que se espera a que llegue.
 */
export async function enlaceDelCorreo(request: APIRequestContext, email: string, ruta: string): Promise<string> {
  const patron = new RegExp(`/auth/${ruta}#token=[\\w-]+`);
  let enlace: string | undefined;
  await expect.poll(async () => {
    const busqueda = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"` } });
    if (!busqueda.ok()) {
      return undefined;
    }
    for (const resumen of (await busqueda.json()).messages ?? []) {
      const mensaje = await (await request.get(`${MAILPIT}/api/v1/message/${resumen.ID}`)).json();
      const encontrado = patron.exec(mensaje.Text ?? '');
      if (encontrado) {
        enlace = encontrado[0];
        return enlace;
      }
    }
    return undefined;
  }, { message: `correo con /auth/${ruta} para ${email} en Mailpit`, timeout: 20_000 }).toBeDefined();
  return enlace!;
}

/** Registra un cliente desde el formulario y confirma su correo con el enlace de Mailpit. */
export async function registrarYConfirmar(
  page: Page, request: APIRequestContext, cliente: { usuario: string; clave: string; email: string }
): Promise<void> {
  await page.goto('/auth/register');
  await page.getByPlaceholder('Usuario', { exact: true }).fill(cliente.usuario);
  await page.getByPlaceholder('Nombre', { exact: true }).fill('Prueba');
  await page.getByPlaceholder('Primer apellido', { exact: true }).fill('E2E');
  await page.getByPlaceholder('Correo electrónico', { exact: true }).fill(cliente.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(cliente.clave);
  await page.getByPlaceholder('Repite tu contraseña', { exact: true }).fill(cliente.clave);
  await page.locator('input[name="politicas"]').check();
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

  await page.goto(await enlaceDelCorreo(request, cliente.email, 'verificar'));
  await expect(page.getByText('Correo confirmado. Ya puedes iniciar sesión.')).toBeVisible();
}

/**
 * Cliente nuevo con el correo ya confirmado, creado por la API (mas rapido que el formulario,
 * que ya se prueba en 02-pedido). Sirve con cualquier APIRequestContext, tambien en beforeAll.
 */
export async function crearClienteConfirmado(
  request: APIRequestContext, prefijo: string
): Promise<{ usuario: string; clave: string; email: string }> {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const cliente = { usuario: `${prefijo}_${sufijo}`, clave: `Clave${sufijo}A1`, email: `${prefijo}_${sufijo}@barhub.test` };
  const alta = await request.post('/api/auth/signup', {
    data: { username: cliente.usuario, email: cliente.email, password: cliente.clave, nombre: 'Prueba', apellido1: 'E2E' },
  });
  expect(alta.ok(), `alta de ${cliente.usuario}: ${await alta.text()}`).toBe(true);

  const enlace = await enlaceDelCorreo(request, cliente.email, 'verificar');
  const confirmacion = await request.post('/api/auth/verificar', { data: { token: enlace.split('#token=')[1] } });
  expect(confirmacion.ok(), 'confirmación del correo').toBe(true);
  return cliente;
}

/** Con el administrador ya dentro: alta de un empleado desde el panel. */
export async function darDeAltaEmpleado(page: Page, empleado: { usuario: string; clave: string }): Promise<void> {
  await page.goto('/admin/crear-usuario');
  await page.locator('#username').fill(empleado.usuario);
  await page.locator('#email').fill(`${empleado.usuario}@barhub.test`);
  await page.locator('#password').fill(empleado.clave);
  await page.getByLabel('EMPLEADO').check();
  await page.locator('#nombre').fill('Lucía');
  await page.locator('#apellido1').fill('E2E');
  await page.getByRole('button', { name: 'Crear Usuario' }).click();

  await expect(page).toHaveURL(/\/admin\/gestionar-usuarios$/);
  await expect(filasConDatos(page).filter({ hasText: empleado.usuario })).toBeVisible();
}
