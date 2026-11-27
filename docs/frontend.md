# Frontend

Aplicación **Angular 22** organizada en módulos por área funcional, con rutas protegidas por guardas, interceptor de autenticación y actualización periódica de datos.

## Índice

1. [Configuración del proyecto](#1-configuración-del-proyecto)
2. [Mapa de rutas y áreas](#2-mapa-de-rutas-y-áreas)
3. [Módulo de autenticación](#3-módulo-de-autenticación)
4. [Área pública](#4-área-pública)
5. [Área de administración](#5-área-de-administración)
6. [Componentes compartidos](#6-componentes-compartidos)
7. [Actualización de datos en el cliente](#7-actualización-de-datos-en-el-cliente)
8. [Estilos, temas y accesibilidad](#8-estilos-temas-y-accesibilidad)
9. [Idiomas](#9-idiomas)

---

## 1. Configuración del proyecto

Archivos de la raíz `frontend/`:

| Archivo | Función |
| :--- | :--- |
| `angular.json` | Configuración de Angular CLI: build, optimizaciones, entornos |
| `package.json` / `package-lock.json` | Dependencias y scripts (`npm start`, `npm build`, `npm test`) |
| `Caddyfile` | Servidor estático del contenedor: caché (`immutable` para los bundles con hash, `no-cache` para el resto) y reescritura de rutas de la SPA |
| `Dockerfile` | Multi-etapa (Node.js + Caddy) para producción, usuario no root y `HEALTHCHECK` |
| `.editorconfig` | Estilo de código consistente entre editores |

```bash
npm ci --legacy-peer-deps   # igual que en el CI y en Docker; alguna dependencia aún declara versiones antiguas de Angular
npm start
npm test                              # tests unitarios con Vitest
npm test -- --watch=false --coverage  # con cobertura (coverage/BarHub/lcov.info, el que lee SonarCloud)
```

Versiones y decisiones de la migración a Angular 22 (versión 2.1):

| Pieza | Situación |
| :--- | :--- |
| Angular | 22, migrado desde la 14 versión a versión con `ng update` |
| Build | Builder `application` (esbuild); la web compilada queda en `dist/barhub/browser`, que es lo que copia el Dockerfile |
| TypeScript | 6.0; `tsconfig.json` usa `paths` para los imports `src/...` en lugar de `baseUrl`, que TypeScript 6 declara obsoleto |
| Node.js | 24, en Docker y en el CI |
| Detección de cambios | `ChangeDetectionStrategy.Eager` en todos los componentes: la migración de la 22 conserva así el comportamiento de antes |
| Plantillas | Parte de las plantillas ya usa el control flow nuevo (`@if`, `@for`) |
| Ticket en PDF | `pdfmake` se carga con `import()` dinámico solo al generar el ticket: el bundle inicial bajó de 2,80 MB a 1,13 MB |
| CSP | La build de producción desactiva `inlineCritical`: Angular cargaría la hoja de estilos con un `onload` en línea, que la CSP de Caddy bloquea. No hay scripts en línea ni `eval`; los estilos de los componentes sí van en línea (`style-src 'unsafe-inline'`) |
| Tests | Vitest con jsdom (sin navegador), desde el builder `@angular/build:unit-test`; se ejecutan en el CI y su cobertura va a SonarCloud. Los recorridos completos en navegador están en [`e2e/`](../e2e/README.md) (Playwright) |

Tests unitarios actuales:

| Archivo | Qué comprueba |
| :--- | :--- |
| `services/theme.service.spec.ts` | Tema guardado frente a la preferencia del sistema, `data-bs-theme`, clase `dark-theme` e `isDarkMode$` |
| `auth/role.guard.spec.ts` | Acceso por rol: admin, empleado, cliente y sin sesión |
| `auth/auth.interceptor.spec.ts` | Cabecera `Bearer`, limpieza de la sesión y redirección al login ante un 401 |
| `main/services/shared/services/dialog.service.spec.ts` | Toast sin interpretar HTML, modal y la confirmación cancelada que no se ejecuta después |
| `app.component.spec.ts` | Título y estructura de menú, contenido y pie |
| `public/home`, `shared/footer` | Que los componentes se crean |


## 2. Mapa de rutas y áreas

`AppRoutingModule` divide la navegación en tres áreas:

```mermaid
flowchart TB
    R[AppRoutingModule]
    R --> P["Área pública<br/>(cliente y visitantes)"]
    R --> A["Área de autenticación<br/>login · registro"]
    R --> AD["Área de administración<br/>protegida con guards"]
    P -.-> G1[auth.guard / role.guard]
    AD -.-> G2[auth.guard + role.guard]
```

| Área | Acceso | Contenido |
| :--- | :--- | :--- |
| Pública | Visitantes y clientes; vistas de personal con guarda | Carta, pedidos, mesas, contacto, políticas |
| Autenticación | Abierta | Login y registro |
| Administración | Rol admin | CRUD del negocio y métricas |

## 3. Módulo de autenticación

`auth/`

| Pieza | Función |
| :--- | :--- |
| `login` | Formulario de inicio de sesión |
| `register` | Registro de usuarios nuevos |
| `auth.service.ts` | Lógica de autenticación, almacenamiento del token y estado de sesión |
| `auth.guard.ts` | Exige sesión iniciada |
| `role.guard.ts` | Exige el rol adecuado para la ruta |
| `auth.interceptor.ts` | Adjunta el token JWT a las peticiones HTTP salientes |

```mermaid
sequenceDiagram
    participant U as Usuario
    participant L as login
    participant S as auth.service
    participant I as auth.interceptor
    participant API as Backend

    U->>L: credenciales
    L->>S: login()
    S->>API: POST /api/auth/login
    API-->>S: JWT + roles
    S->>S: guarda token y sesión
    U->>I: cualquier petición HTTP
    I->>API: añade cabecera Authorization
```

## 4. Área pública

`public/` · experiencia del cliente y operativa diaria del personal.

| Componente | Función | Usuario |
| :--- | :--- | :--- |
| `home` | Página de inicio | Todos |
| `carta` | Menú de productos | Cliente |
| `confirmar-pedido` | Revisión y confirmación del pedido y pago. Con tarjeta (`PagoService`): pide al servidor si hay pago con tarjeta y su clave publicable, carga Stripe.js solo al elegirla, crea el intento de pago en el servidor, lo confirma con `confirmCardPayment` y crea el pedido con el id del pago. Un pago cobrado cuyo pedido no llega a crearse se guarda en `barhub.pagoPendiente` y se reutiliza al reintentar (si el carrito es el mismo), para no cobrar dos veces | Cliente |
| `seguimiento-pedidos` | Estado actual del pedido | Cliente |
| `perfil` | Mi perfil: cabecera con foto y estado de la cuenta, y pestañas como rutas hijas (`datos`, `direccion`, `cuenta`, `seguridad`, `privacidad`). `PerfilService` (proveído en el componente) comparte el perfil entre la cabecera y las pestañas | Todos con sesión |
| `contacto` | Formulario e información de contacto | Todos |
| `politica-privacidad`, `terminos-condiciones` | Páginas legales | Todos |
| `gestionar-comandas` | Comandas con actualización automática | Empleado |
| `gestionar-mesas-empleado` | Estado de las mesas | Empleado |
| `gestionar-pagos-efectivo` | Registro de pagos en efectivo | Empleado |
| `gestionar-caja` | Apertura, cierre y transacciones | Empleado |

## 5. Área de administración

`admin/` · estilos compartidos en `crud-styles.css`. Cada entidad sigue el patrón **gestionar / editar / ver**.

| Módulo | Componentes | Función |
| :--- | :--- | :--- |
| `bienvenida` | — | Dashboard inicial |
| `productos` | `gestionar-productos`, `editar-productos`, `ver-producto` | Catálogo de la carta |
| `pedidos` | `gestionar-pedidos`, `editar-pedidos`, `ver-pedido` | Control general de pedidos |
| `detalles_pedidos` | `gestionar-detalles`, `editar-detalles`, `ver-detalle` | Líneas de cada pedido |
| `mesas` | `gestionar-mesas`, `editar-mesas`, `ver-mesa` | Distribución y estado de mesas |
| `usuarios` | `gestionar-usuarios`, `editar-usuarios`, `ver-usuario` | Cuentas, roles y permisos |
| `metricas` | — | Estadísticas y rendimiento del negocio |
| `registro-jornada` | — | Entradas, salidas y horas del personal |
| `auditoria` | — | Registro de auditoría con filtros por fechas, usuario, acción y resultado, paginado (`AuditoriaService`) |

## 6. Componentes compartidos

| Carpeta | Contenido |
| :--- | :--- |
| `shared/custom-toast` | Notificaciones flotantes (feedback visual) |
| `shared/footer` | Pie de página común |
| `shared/modals` | Diálogos reutilizables, p. ej. `modal-confirmar-eliminar` |
| `uicomponents/menu` | Navegación principal |

## 7. Actualización de datos en el cliente

Las comandas, las mesas, los pagos en efectivo y el seguimiento del cliente se actualizan con los avisos del servidor (Server-Sent Events, ver [backend.md](backend.md#6-actualización-de-datos)). `TiempoRealService.recargas(canal)` devuelve un `Observable` que emite cuando hay que volver a pedir los datos; cada pantalla lo combina con su petición de siempre (`switchMap`). Las escrituras se hacen siempre por REST.

| Aspecto | Detalle |
| :--- | :--- |
| Conexión | `fetch` leyendo el cuerpo como flujo, y no `EventSource`, que no deja enviar la cabecera `Authorization`: así el token no va en la URL ni en los logs |
| Canales | `personal` (comandas, mesas y pagos) y `mis-pedidos` (seguimiento del cliente) |
| Cuándo recarga | Al entrar, con cada aviso de `pedido` o `mesa` (los que llegan juntos en 250 ms se agrupan), al reconectar y, por si se perdiera alguno, cada 60 s |
| Sin conexión | Se reconecta sola esperando 1, 2, 4… hasta 30 s y, mientras tanto, recarga cada 5 s como antes. Un token caducado se renueva en la siguiente recarga, que va por `HttpClient` y su interceptor |
| Listas | `@for` con `track` por id: una recarga no vuelve a pintar las tarjetas ni cierra lo que estaba abierto |
| Buenas prácticas | La suscripción se cancela al salir de la pantalla (`takeUntil` en `ngOnDestroy`), lo que cierra la conexión |

### Comandas: aviso sonoro e impresión

- **Aviso sonoro** (`AvisoSonoroService`): dos pitidos cortos generados con Web Audio, sin ficheros de sonido, cuando entra una comanda nueva. Lo activa cada persona con el botón de la cabecera y se recuerda en el navegador (`barhub.avisoSonoroComandas`). Los navegadores solo dejan sonar después de un clic en la página, por eso al activarlo suena una vez de prueba.
- **Imprimir comanda**: cada tarjeta tiene un botón que pinta la comanda en `.ticket-comanda` y llama a `window.print()`. Mientras se imprime, el `body` lleva `imprimiendo-comanda` y `styles.css` oculta todo lo demás (`@media print` con `:has()`) y deja el ticket a 72 mm, el ancho que imprime una térmica de 80 mm, en letra monoespaciada, negro sobre blanco. Lleva número de pedido, modalidad y ubicación, hora del pedido y de impresión, productos con cantidad, notas y alérgenos por nombre («sin indicar, consultar» si el producto no los tiene indicados). Al terminar (`afterprint`) todo vuelve a su estado. En la impresora, elegir el tamaño de papel de 80 mm y márgenes mínimos.

## 8. Estilos, temas y accesibilidad

| Elemento | Detalle |
| :--- | :--- |
| `crud-styles.css` | Estilos compartidos del área de administración |
| Estilos por componente | Hojas específicas de cada vista |
| `theme.service.ts` | Gestión de temas para adaptabilidad visual |
| `assets/` | Imágenes corporativas y de fondo |

**Accesibilidad (WCAG):** todas las interfaces se refactorizaron para cumplir los ratios mínimos de contraste: colores sólidos optimizados, eliminación de opacidades conflictivas en textos y contraste verificado en botones y elementos interactivos. Además, tras la auditoría de SonarQube, cada `<input>` y `<select>` tiene su `<label>` asociado para ofrecer nombres accesibles.

## 9. Idiomas

Las pantallas del cliente están en **español, portugués (de Portugal) e inglés (británico)**. El personal y la administración siguen en español. Los textos de la interfaz se traducen en el navegador, sin librerías; los nombres y descripciones de los productos, que escribe el bar, vienen traducidos de la API (ver abajo).

| Pieza | Detalle |
| :--- | :--- |
| Textos | `shared/i18n/textos.es.ts` es la referencia; `textos.pt.ts` y `textos.en.ts` son `Record<Clave, string>`, así que TypeScript no deja compilar si falta una clave. Un test comprueba además que cada traducción lleva los mismos datos entre llaves (`{id}`, `{n}`...) |
| En las plantillas | `{{ 'carta.titulo' \| t }}` y, con datos, `{{ 'carta.mesa.opcion' \| t: { id: mesa.id } }}`. Precios con `{{ producto.precio \| precio }}` (`Intl.NumberFormat`: 12,50 € en español y portugués, €12.50 en inglés) |
| En el código | `IdiomaService.t(clave, datos)` para avisos y textos montados en TypeScript; `tSiExiste` para claves que salen de la API (estados de pedidos y mesas) |
| Cambio al momento | El idioma es una señal; las tuberías `t` y `precio` no son puras, así que al cambiarlo se repinta lo que esté a la vista, también en componentes `OnPush` |
| Selector | `SelectorIdiomaComponent` en el menú: una pastilla con tres botones redondos con la bandera de España, Portugal y Reino Unido (SVG dibujado, sin imágenes), como el interruptor del modo oscuro. Cada botón lleva el nombre del idioma en ese idioma, su `lang` y `aria-pressed` en el activo |
| Productos | `nombrePt`, `nombreEn`, `descripcionPt` y `descripcionEn` de cada producto (los escribe el administrador). `nombreDe()` y `descripcionDe()` de `producto-idioma.ts` eligen la del idioma y, si falta, la española. Se usan en la carta, la confirmación y el seguimiento |
| Primera visita | Si el navegador está en portugués o inglés, se usa ese; si no, español. La elección se guarda en `barhub.idioma` |
| Accesibilidad | Se cambia el `lang` de `<html>` para que los lectores de pantalla pronuncien bien. Los alérgenos tienen el nombre del Reglamento (UE) 1169/2011 en cada idioma |
| Stripe | El formulario de la tarjeta se crea con el idioma elegido (`elements({ locale })`) |
| Mensajes de la API | El servidor responde en español. `IdiomaService.delServidor(mensaje, clave)` lo muestra tal cual en español y, en portugués o inglés, pone el texto de la clave, que dice lo mismo sin los detalles (por ejemplo, «Incorrect code.») |
| Fechas | `IdiomaService.fecha()` y los formatos de las sesiones («há 2 horas», «2 hours ago») usan la configuración regional del idioma |
| Tests | `src/test-setup.ts` deja el idioma en español antes de cada fichero de Vitest, porque jsdom dice estar en inglés; los tests de idiomas lo cambian por su cuenta |
| Sin traducir | El ticket en PDF del pedido (factura simplificada, documento fiscal) y la comanda impresa para cocina, que salen en español |

Están traducidas todas las pantallas del cliente: menú y pie, portada, carta, confirmación del pedido, seguimiento, inicio de sesión, registro, verificación en dos pasos, recuperar la contraseña y los enlaces del correo, el perfil con sus cinco pestañas, contacto, la política de privacidad y los términos y condiciones (enteros), y los avisos comunes (sesión a punto de cerrarse, confirmar que eres tú, diálogos).
