# Tests de extremo a extremo (E2E)

Tests con [Playwright](https://playwright.dev) que recorren BarHub como un usuario, en un navegador real y contra la aplicación completa: Caddy, frontend, backend y MariaDB. Complementan a los tests unitarios (JUnit en el backend, Vitest en el frontend), que prueban cada pieza por separado.

## Qué se prueba

| Archivo | Recorrido |
| :--- | :--- |
| `01-publico.spec.ts` | Portada y menú; la carta no deja añadir productos sin indicar la modalidad; las pantallas del personal y del administrador rechazan a un visitante; un login incorrecto no inicia sesión |
| `02-pedido.spec.ts` | Un cliente nuevo se registra, no puede entrar hasta abrir el enlace de confirmación que llega a Mailpit, y después pide para recoger, confirma, descarga el ticket en PDF y ve el pedido en el seguimiento; no puede entrar en las pantallas del personal; el personal ve la comanda y la marca como lista; el administrador la ve en la gestión de pedidos |
| `03-caja.spec.ts` | El personal abre la caja y la cierra con su arqueo |
| `04-admin.spec.ts` | Panel de administración, listados de productos y usuarios (con sus roles) y métricas |
| `05-sesion.spec.ts` | Con un cliente creado por la API: la cookie de renovación es `HttpOnly` y `SameSite=Strict`; con el token de acceso caducado la sesión se renueva sola; si ya no se puede renovar, el login avisa; cerrar sesión revoca la cookie y el token en el servidor; el aviso de inactividad aparece con su cuenta atrás, "Seguir conectado" renueva y, sin respuesta, la sesión se cierra |
| `06-turno.spec.ts` | El administrador da de alta a un empleado desde el panel; el empleado entra con esa contraseña (configurando la verificación en dos pasos) y termina su turno desde el menú; el administrador lo ve en el registro de jornada |
| `07-correo.spec.ts` | Recuperar la contraseña con el enlace de Mailpit: la nueva sustituye a la vieja, cierra las sesiones de otros navegadores, el enlace no sirve dos veces, y un correo inexistente responde igual sin enviar nada |
| `08-dos-factores.spec.ts` | Un empleado nuevo no recibe ningún token hasta configurar la app de autenticación (QR, clave escrita, un código incorrecto no la activa) y guardar los 10 códigos de recuperación; sin el móvil entra con uno de ellos, que no sirve una segunda vez; el administrador se la restablece desde el listado de usuarios y el empleado tiene que configurarla otra vez |
| `09-perfil.spec.ts` | Mi perfil: cada pestaña tiene su URL y el botón «atrás» funciona; datos y dirección se guardan por separado; cambiar la contraseña cierra la sesión de otro navegador; se ven las sesiones abiertas y se cierran las demás; un cliente activa la verificación en dos pasos, su login la pide y la vuelve a quitar |

En todos los tests se comprueba además que la página no lanza errores de JavaScript sin capturar. Solo se permiten peticiones a la propia aplicación: Stripe, Google Maps y Google Fonts se bloquean para que el resultado no dependa de servicios de terceros.

Los tests van uno detrás de otro (`workers: 1`) porque comparten la base de datos.

### Verificación en dos pasos

El administrador y los empleados tienen que pasar el segundo paso. `iniciarSesion()` lo hace como la app del móvil: calcula el código TOTP con el secreto del usuario. Si el usuario aún no la tiene, la configura con la clave que muestra la pantalla y guarda el secreto y los códigos de recuperación en `e2e/.auth/totp.json` (fuera del repositorio). El servidor no acepta dos veces el código del mismo intervalo de 30 segundos, así que dos logins seguidos del administrador esperan al siguiente: por eso los tests de sesión usan un cliente.

## En el CI

El job `e2e` del workflow genera claves aleatorias, levanta la aplicación con `docker compose` y los datos de demostración (`APP_SEED_DEMO=true`), espera a que la API sirva la carta y ejecuta los tests. Si alguno falla, sube como artefacto el informe de Playwright con capturas y trazas. La imagen del frontend solo se publica en Docker Hub si pasan el análisis y los tests E2E.

## En local

Con la aplicación levantada en `http://localhost` (ver el README principal):

```bash
cd e2e
npm ci --ignore-scripts
npm run navegador                     # descarga Chromium para Playwright (una vez)
read -rs 'E2E_ADMIN_PASSWORD?Clave del admin: '; echo; export E2E_ADMIN_PASSWORD   # zsh; en bash: read -rsp 'Clave del admin: ' E2E_ADMIN_PASSWORD
read -rs 'E2E_ADMIN_TOTP_SECRET?Clave TOTP del admin: '; echo; export E2E_ADMIN_TOTP_SECRET   # solo si ya la configuraste a mano
npm test
npm run informe                       # informe HTML del último resultado
```

Variables opcionales: `E2E_URL` (por defecto `http://localhost`), `E2E_ADMIN_USER` (por defecto `admin`), `E2E_MAILPIT_URL` (por defecto `http://localhost:8025`) y `E2E_ADMIN_TOTP_SECRET`. Esta última es la clave que mostró la pantalla al configurar la verificación del administrador (la de *«¿No puedes escanearlo? Escribe esta clave»*): hace falta si la configuraste tú desde el navegador. Antes de empezar se comprueba que lo sea: un código de 6 dígitos o un código de recuperación se rechazan con un aviso. Si la configuran los propios tests, la guardan en `e2e/.auth/totp.json`, y puedes añadir esa misma clave a tu app para entrar con ese administrador. Los tests de registro y recuperación leen los correos de Mailpit, así que tiene que estar levantado.

En local los tests escriben en tu base de datos: crean clientes `e2e_*`, `e2es_*` y `e2ep_*` (uno con un pedido de prueba) y empleados `emp_*` y `dosf_*`, y dejan una caja abierta y cerrada en el historial. Si al empezar hay una caja abierta, el test de caja la cierra primero.
