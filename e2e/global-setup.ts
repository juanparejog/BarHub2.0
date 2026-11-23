/**
 * Comprueba que E2E_ADMIN_TOTP_SECRET es una clave TOTP (Base32: letras A-Z y digitos del 2 al 7)
 * y no el codigo de 6 digitos de la app o un codigo de recuperacion, que es la confusion habitual.
 */
export function comprobarClaveTotp(clave: string): string {
  const limpia = clave.replace(/\s/g, '').toUpperCase();
  if (/^[A-Z2-7]{16,}=*$/.test(limpia)) {
    return limpia;
  }
  const pista = /^\d{6}$/.test(limpia) ? ' Has puesto un código de 6 dígitos de la app.'
    : /^[A-Z2-9]{5}-?[A-Z2-9]{5}$/.test(limpia) ? ' Parece un código de recuperación.' : '';
  throw new Error('E2E_ADMIN_TOTP_SECRET no es la clave TOTP del administrador: tiene que ser la de '
    + '«¿No puedes escanearlo? Escribe esta clave», solo con letras A-Z y dígitos del 2 al 7.' + pista);
}

/**
 * Antes de los tests, espera a que la API sirva la carta: justo despues de `docker compose up`
 * el backend tarda unos segundos en arrancar y los primeros tests fallarian sin motivo.
 */
export default async function esperarALaApi(): Promise<void> {
  // Mejor fallar aqui una vez que en cada test del administrador
  if (process.env.E2E_ADMIN_TOTP_SECRET) {
    comprobarClaveTotp(process.env.E2E_ADMIN_TOTP_SECRET);
  }
  const base = process.env.E2E_URL ?? 'http://localhost';
  const limite = Date.now() + 180_000;
  let ultimoError = '';
  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(`${base}/api/productos/`);
      if (respuesta.ok && (await respuesta.text()).includes('"nombre"')) {
        return;
      }
      ultimoError = `HTTP ${respuesta.status}`;
    } catch (error) {
      ultimoError = String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error(`La API no responde en ${base}/api/productos/ tras 3 minutos (${ultimoError}). ¿Está levantada la aplicación?`);
}
