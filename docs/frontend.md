# Frontend

Aplicación **Angular 14** organizada en módulos por área funcional, con rutas protegidas por guardas, interceptor de autenticación y actualización periódica de datos.

## Índice

1. [Configuración del proyecto](#1-configuración-del-proyecto)
2. [Mapa de rutas y áreas](#2-mapa-de-rutas-y-áreas)
3. [Módulo de autenticación](#3-módulo-de-autenticación)
4. [Área pública](#4-área-pública)
5. [Área de administración](#5-área-de-administración)
6. [Componentes compartidos](#6-componentes-compartidos)
7. [Actualización de datos en el cliente](#7-actualización-de-datos-en-el-cliente)
8. [Estilos, temas y accesibilidad](#8-estilos-temas-y-accesibilidad)

---

## 1. Configuración del proyecto

Archivos de la raíz `frontend/`:

| Archivo | Función |
| :--- | :--- |
| `angular.json` | Configuración de Angular CLI: build, optimizaciones, entornos |
| `package.json` / `package-lock.json` | Dependencias y scripts (`npm start`, `npm build`, `npm test`) |
| `Caddyfile` | Servidor estático del contenedor: caché (`immutable` para los bundles con hash, `no-cache` para el resto) y reescritura de rutas de la SPA |
| `Dockerfile` | Multi-etapa (Node.js + Caddy) para producción, usuario no root y `HEALTHCHECK` |
| `karma.conf.js` | Pruebas unitarias con Karma + Jasmine (usa el prefijo `node:path`) |
| `.browserslistrc` | Navegadores objetivo |
| `.editorconfig` | Estilo de código consistente entre editores |

```bash
npm install --legacy-peer-deps   # necesario por restricciones de peer deps de Angular 14
npm start
npm test
```

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
| `confirmar-pedido` | Revisión y confirmación del pedido | Cliente |
| `seguimiento-pedidos` | Estado actual del pedido | Cliente |
| `perfil` | Datos del perfil | Cliente |
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

## 6. Componentes compartidos

| Carpeta | Contenido |
| :--- | :--- |
| `shared/custom-toast` | Notificaciones flotantes (feedback visual) |
| `shared/footer` | Pie de página común |
| `shared/modals` | Diálogos reutilizables, p. ej. `modal-confirmar-eliminar` |
| `uicomponents/menu` | Navegación principal |

## 7. Actualización de datos en el cliente

No se usa Socket.IO ni WebSocket. Las pantallas con estado cambiante (seguimiento del pedido del cliente y vistas del personal) consultan la API cada 5 segundos. Las escrituras se hacen siempre por REST.

| Aspecto | Detalle |
| :--- | :--- |
| Frecuencia | Cada 5 s |
| Patrón | Carga inicial y refresco periódico |
| Buenas prácticas | Cancelar la suscripción al destruir el componente (`ngOnDestroy`) para no acumular peticiones |
| Seguimiento del cliente | Solo con sesión iniciada |
| Alternativa futura | SSE o WebSocket, ver [backend.md](backend.md#6-actualización-de-datos) |

## 8. Estilos, temas y accesibilidad

| Elemento | Detalle |
| :--- | :--- |
| `crud-styles.css` | Estilos compartidos del área de administración |
| Estilos por componente | Hojas específicas de cada vista |
| `theme.service.ts` | Gestión de temas para adaptabilidad visual |
| `assets/` | Imágenes corporativas y de fondo |

**Accesibilidad (WCAG):** todas las interfaces se refactorizaron para cumplir los ratios mínimos de contraste: colores sólidos optimizados, eliminación de opacidades conflictivas en textos y contraste verificado en botones y elementos interactivos. Además, tras la auditoría de SonarQube, cada `<input>` y `<select>` tiene su `<label>` asociado para ofrecer nombres accesibles.