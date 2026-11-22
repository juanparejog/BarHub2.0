# Tests de extremo a extremo (E2E)

Tests con [Playwright](https://playwright.dev) que recorren BarHub como un usuario, en un navegador real y contra la aplicación completa: Caddy, frontend, backend y MariaDB. Complementan a los tests unitarios (JUnit en el backend, Vitest en el frontend), que prueban cada pieza por separado.

## Qué se prueba

| Archivo | Recorrido |
| :--- | :--- |
| `01-publico.spec.ts` | Portada y menú; la carta no deja añadir productos sin indicar la modalidad; las pantallas del personal y del administrador rechazan a un visitante; un login incorrecto no inicia sesión |
| `02-pedido.spec.ts` | Un cliente nuevo se registra, pide para recoger, confirma, descarga el ticket en PDF y ve el pedido en el seguimiento; no puede entrar en las pantallas del personal; el personal ve la comanda y la marca como lista; el administrador la ve en la gestión de pedidos |
| `03-caja.spec.ts` | El personal abre la caja y la cierra con su arqueo |
| `04-admin.spec.ts` | Panel de administración, listados de productos y usuarios (con sus roles) y métricas |

En todos los tests se comprueba además que la página no lanza errores de JavaScript sin capturar. Solo se permiten peticiones a la propia aplicación: Stripe, Google Maps y Google Fonts se bloquean para que el resultado no dependa de servicios de terceros.

Los tests van uno detrás de otro (`workers: 1`) porque comparten la base de datos.

## En el CI

El job `e2e` del workflow genera claves aleatorias, levanta la aplicación con `docker compose` y los datos de demostración (`APP_SEED_DEMO=true`), espera a que la API sirva la carta y ejecuta los tests. Si alguno falla, sube como artefacto el informe de Playwright con capturas y trazas. La imagen del frontend solo se publica en Docker Hub si pasan el análisis y los tests E2E.

## En local

Con la aplicación levantada en `http://localhost` (ver el README principal):

```bash
cd e2e
npm ci --ignore-scripts
npm run navegador                     # descarga Chromium para Playwright (una vez)
read -rs 'E2E_ADMIN_PASSWORD?Clave del admin: '; echo; export E2E_ADMIN_PASSWORD   # zsh; en bash: read -rsp 'Clave del admin: ' E2E_ADMIN_PASSWORD
npm test
npm run informe                       # informe HTML del último resultado
```

Variables opcionales: `E2E_URL` (por defecto `http://localhost`) y `E2E_ADMIN_USER` (por defecto `admin`).

En local los tests escriben en tu base de datos: crean un cliente `e2e_*` con un pedido de prueba y dejan una caja abierta y cerrada en el historial. Si al empezar hay una caja abierta, el test de caja la cierra primero.
