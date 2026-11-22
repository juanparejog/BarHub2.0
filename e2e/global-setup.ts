/**
 * Antes de los tests, espera a que la API sirva la carta: justo despues de `docker compose up`
 * el backend tarda unos segundos en arrancar y los primeros tests fallarian sin motivo.
 */
export default async function esperarALaApi(): Promise<void> {
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
