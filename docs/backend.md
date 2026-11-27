# Backend

El backend de BarHub 2.0 expone una **API REST** securizada con JWT. Los cambios de comandas, mesas y pedidos llegan al frontend al momento por Server-Sent Events (`/eventos`); si la conexión se corta, el frontend vuelve a consultar cada 5 s.

## Índice

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura en capas](#2-arquitectura-en-capas)
3. [API REST](#3-api-rest)
4. [Roles y control de acceso](#4-roles-y-control-de-acceso)
5. [Ciclo de vida de un pedido](#5-ciclo-de-vida-de-un-pedido)
6. [Actualización de datos](#6-actualización-de-datos)
7. [Calidad del código](#7-calidad-del-código)

---

## 1. Stack tecnológico

| Componente | Tecnología | Notas |
| :--- | :--- | :--- |
| Lenguaje / framework | Java 21 + **Spring Boot 4.2.0** | Spring Framework 7, Spring Security 7, Hibernate 7, Tomcat 11 y Jackson 3. Migrado desde 3.5.16 en la 2.1 ([auditorias.md](auditorias.md)) |
| Build | Gradle | `./gradlew clean build -x test` |
| Base de datos | **MariaDB** | Modelo ER en [base-de-datos.md](base-de-datos.md) |
| Autenticación | **JWT** (`jjwt 0.13.0`, serialización con Gson) | Implementado en `JwtUtils.java` con el API moderno |
| Conector BBDD | `mariadb-java-client` 4.0.0 | TLS por defecto con el certificado del servidor verificado ([evidencia](evidencias/tls-mariadb-2026-11-20.md)) |
| JSON | Jackson 3 con `spring.jackson.use-jackson2-defaults` | La API acepta y devuelve el mismo JSON que con Spring Boot 3.5 |
| Actualización de datos | Sondeo REST desde el frontend | Ver [sección 6](#6-actualización-de-datos) |
| Fechas | `java.time` / `Instant` | Sustituye al obsoleto `new Date()` |

## 2. Arquitectura en capas

```mermaid
flowchart TB
    CL[Cliente HTTP] --> SEC[Filtro de seguridad JWT]
    SEC --> CTRL[Controladores REST]
    CTRL --> SRV[Servicios<br/>PedidoServiceImpl, ...]
    SRV --> REPO[Repositorios JPA]
    REPO --> DB[(MariaDB)]
```

| Capa | Responsabilidad |
| :--- | :--- |
| **Seguridad** | Valida el JWT y carga `UserDetailsImpl` con sus roles |
| **Controladores** | Reciben peticiones, validan entrada y devuelven respuestas HTTP estandarizadas |
| **Servicios** | Lógica de negocio. Métodos extensos desglosados en auxiliares privados cohesivos |
| **Repositorios** | Acceso a datos |
| **Modelo / `model/enums`** | Entidades y enumerados (estados, tipos de pedido, categorías) |

`spring.jpa.open-in-view` está desactivado: la sesión de Hibernate termina con la transacción del servicio, no con la petición. Por eso los controladores solo convierten a DTO lo que ya está cargado, y las relaciones perezosas que necesita la respuesta se piden en el repositorio con `@EntityGraph` (detalles y productos de los pedidos, roles de los usuarios) o se leen dentro de un método `@Transactional`. Si un endpoint nuevo recorre una relación sin cargarla, falla con `LazyInitializationException`; `CargaPerezosaIntegrationTest` lo comprueba sin transacción en el test, que ocultaría el fallo.

## 3. API REST

### 3.1. Autenticación · `/auth`

Las rutas se muestran como las ve el backend. Desde fuera, Caddy las publica bajo el prefijo `/api` (por ejemplo, `/api/auth/login`).

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/auth/signup` | Registro de nuevos usuarios (clientes o personal) |
| `POST` | `/auth/login` | Inicio de sesión: token de acceso JWT (15 min) en el cuerpo y cookie `HttpOnly` de renovación; `403 EMAIL_NO_VERIFICADO` si falta confirmar el correo. Si la cuenta usa (o su rol exige) la verificación en dos pasos, responde `{requiere2fa, configurar, desafio}` sin token |
| `POST` | `/auth/2fa/verificar` | Segundo paso con el desafío y el código de la app o uno de recuperación; abre la sesión como el login (`401 CODIGO_INCORRECTO` o `DESAFIO_CADUCADO`) |
| `POST` | `/auth/2fa/configurar` | Para quien aún no la tiene: secreto nuevo (clave Base32 y URI `otpauth://` para el QR) |
| `POST` | `/auth/2fa/activar` | Activa la verificación con el primer código de la app, abre la sesión y devuelve los 10 códigos de recuperación |
| `GET` | `/perfil/seguridad` | Con sesión: correo verificado, estado de la verificación en dos pasos (activa, obligatoria, códigos restantes) y fecha de alta |
| `PUT` | `/perfil/password` | Cambia la propia contraseña con la actual y cierra las demás sesiones |
| `POST` | `/perfil/dos-factores/configurar`, `/perfil/dos-factores/activar` | Activa la verificación en dos pasos desde el perfil (activar exige reautenticación) |
| `POST` | `/perfil/dos-factores/codigos` | Genera 10 códigos de recuperación nuevos y anula los anteriores (reautenticación) |
| `DELETE` | `/perfil/dos-factores` | La desactiva, si su rol no la exige (reautenticación) |
| `GET` / `DELETE` | `/perfil/sesiones`, `/perfil/sesiones/{id}` | Sus sesiones abiertas; cerrar una o todas las demás |
| `POST` | `/perfil/correo` | Pide cambiar el correo: envía un enlace al nuevo y un aviso al actual; la cuenta no cambia hasta abrirlo (`202`; `409` si otra cuenta lo usa, `429` si pidió otro hace menos de un minuto; reautenticación) |
| `DELETE` | `/perfil/correo` | Cancela el cambio de correo pendiente: el enlace deja de valer |
| `GET` | `/perfil/mis-datos` | Descarga en JSON todo lo que se guarda de la cuenta (datos, dirección, pedidos, sesiones, registro de jornada y sus últimas 100 entradas de auditoría), sin contraseña ni secretos (reautenticación) |
| `DELETE` | `/perfil` | Elimina la cuenta de un cliente: la anonimiza, conserva sus pedidos sin datos personales y cierra sus sesiones (`400` para el personal; reautenticación) |
| `POST` | `/auth/reautenticar` | Con sesión: confirma de nuevo la identidad (código de la app o, sin 2FA, contraseña) para las acciones críticas de los 5 minutos siguientes; `400 CODIGO_INCORRECTO` si no vale |
| `POST` | `/auth/refresh` | Token de acceso nuevo a partir de la cookie, que se rota; `401` si la sesión está cerrada o caducada |
| `POST` | `/auth/logout` | Cierra la sesión en el servidor y borra la cookie (`204`) |
| `POST` | `/auth/verificar` | Confirma el correo con el token del enlace (`400` si no vale o ha caducado) |
| `POST` | `/auth/reenviar-verificacion` | Vuelve a enviar el correo de confirmación (respuesta genérica) |
| `POST` | `/auth/recuperar` | Envía el enlace para restablecer la contraseña (respuesta genérica) |
| `POST` | `/auth/restablecer` | Contraseña nueva con el token del enlace; cierra todas las sesiones de la cuenta |
| `POST` | `/auth/confirmar-cambio-correo` | Pone en la cuenta el correo nuevo con el token del enlace (ya verificado) y avisa al anterior (`400` si no vale, `409` si otra cuenta lo ha ocupado entretanto) |

### 3.2. Mesas · `/mesas`

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/mesas` | Listado de mesas y estado actual (`disponible`, `ocupada`, `reservada`) |
| `PUT` | `/mesas/{id}` | Actualiza una mesa (código y estado). **Solo administradores** |
| `PATCH` | `/mesas/{id}/estado` | Cambia solo el estado (`{"estado": "OCUPADA"}`). **Empleados y administradores** |

### 3.3. Productos · `/productos`

El listado y la creación se sirven en `/productos/` (con barra final).

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/productos/` | Menú completo, filtrable por categoría (`bebida`, `entrante`, `postre`, `tapa`) |
| `POST` | `/productos/` | Crea un producto (datos y, opcionalmente, imagen). **Solo administradores** |
| `PUT` | `/productos/{id}` | Actualiza un producto y, si se envía, su imagen. **Solo administradores** |
| `DELETE` | `/productos/{id}` | Elimina un producto y su imagen. **Solo administradores** |

Cada producto puede llevar `nombrePt`, `nombreEn`, `descripcionPt` y `descripcionEn` para la carta en portugués e inglés (hasta 100 y 500 caracteres; en blanco se guardan como `null` y la carta usa el español). Con `APP_SEED_DEMO=true`, `demo/demo-traducciones.sql` rellena en cada arranque los productos de demostración que aún no tienen ninguna traducción.

Cada producto lleva `alergenos`: la lista de los 14 de declaración obligatoria (`GLUTEN`, `CRUSTACEOS`, `HUEVOS`, `PESCADO`, `CACAHUETES`, `SOJA`, `LACTEOS`, `FRUTOS_DE_CASCARA`, `APIO`, `MOSTAZA`, `SESAMO`, `SULFITOS`, `ALTRAMUCES`, `MOLUSCOS`) que contiene, en ese orden, o `null` si el bar aún no los ha indicado. `[]` significa indicados y ninguno: no es lo mismo que `null`. Se guardan en `producto_alergenos` y en la columna `productos.alergenos_declarados`.

### 3.4. Pedidos y comandas · `/pedidos`

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/pedidos` | Pedidos en curso para sala y cocina |
| `POST` | `/pedidos` | Crea un pedido indicando modalidad: `domicilio`, `mesa` o `recoger` |
| `PUT` | `/pedidos/{id}` | Avanza el flujo: `pendiente` → `preparado` → `servido` |
| `GET` | `/pedidos/pendientes-efectivo` | Pedidos con pago en efectivo aún pendiente |
| `GET` | `/pedidos/mis-pedidos` | Seguimiento de los pedidos del cliente autenticado |

Con `metodo_pago` `TARJETA`, el pedido lleva `pago_id` (el pago ya cobrado en Stripe) y solo se crea si `VerificacionPago` lo da por bueno ([3.4.1](#341-pago-con-tarjeta--pagos)). El `estado_pago` que mande el cliente no cuenta nunca: en efectivo queda `PENDIENTE`.

### 3.4.1. Pago con tarjeta · `/pagos`

Stripe (PaymentIntents) en **modo de pruebas**. Los datos de la tarjeta van del navegador a Stripe, nunca a BarHub; el servidor crea el intento de pago y, al crear el pedido, comprueba el pago en Stripe con la clave secreta.

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/pagos/configuracion` | Público | `{tarjeta, clavePublica, pruebas}`: si hay pago con tarjeta y la clave publicable para Stripe.js |
| `POST` | `/pagos/intento` | Público (con sesión si el pedido va a ir con ella) | Con `{detalles: [{id_producto, cantidad}]}`, crea el intento de pago por el total que calcula el servidor con los precios de la carta (el que mande el navegador se ignora) y responde `201` con `{id, clientSecret, importe}`. Sin claves de Stripe, `503` |

Al crear el pedido, `VerificacionPago` exige, por este orden: claves de Stripe (`503`), un `pago_id` con formato `pi_...` (`400`), que no lo use ya otro pedido (`409`; `pedidos.pago_id` es único), que exista en Stripe (`400`), que sea del mismo usuario (o de un anónimo, si el pedido es anónimo) (`403`), que esté cobrado (`succeeded`, si no `402`) y que sea por el mismo importe, en euros y para los mismos productos (`409`, y el pago **se devuelve** al momento). Usuario y productos van en los metadatos del intento (`barhub_usuario` y una huella SHA-256 del carrito), así que un pago no sirve para otro carrito del mismo importe ni para otra persona.

Las claves salen de `STRIPE_SECRET_KEY` y `STRIPE_PUBLISHABLE_KEY`. Con `app.pagos.solo-pruebas=true` (por defecto) solo se aceptan claves de pruebas: con unas reales, la tarjeta queda desactivada y se anota en el log. Sin claves, solo se puede pagar en efectivo.

### 3.5. Caja y turnos · `/caja`

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/caja/actual` | Estado de la caja abierta |
| `GET` | `/caja/historial` | Histórico de turnos |
| `POST` | `/caja/abrir` | Abre turno registrando el monto inicial |
| `POST` | `/caja/cerrar` | Cierra turno calculando ventas en efectivo y tarjeta, efectivo real y descuadre |

### 3.5.1. Registro de jornada · `/turnos`

El turno de un empleado empieza al iniciar sesión. Termina con «Terminar turno» o, si no lo pulsa, cuando ya no le queda ninguna sesión abierta: una tarea cada 5 minutos lo cierra con la hora de su última actividad real, no con la caducidad de la sesión.

| Método | Endpoint | Quién | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/turnos/actual` | Empleado o admin | Su turno en curso, o `204` si no tiene |
| `POST` | `/turnos/terminar` | Empleado o admin | Registra la salida ahora; `409` si no hay turno abierto |
| `GET` | `/turnos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | Admin | Turnos del rango (por defecto, los últimos 7 días; como mucho un año) |

### 3.5.2. Registro de auditoría · `/auditoria`

Los endpoints que cambian algo importante llevan `@Auditar(AccionAuditoria.X)`. Al terminar la petición, `AuditoriaInterceptor` guarda quién (de la sesión, o el nombre escrito en un login), la acción, el resultado según la respuesta (`2xx` correcto, `429` bloqueado, otros `4xx` rechazado, `5xx` error), la IP, la petición y, si el endpoint los añade con `Auditoria.objetivo()` y `Auditoria.detalle()`, sobre quién se actuó y qué cambió. Va antes que la reautenticación, así que también queda la acción que esta para. Los `403` de Spring Security por rol se anotan como `ACCESO_DENEGADO` (`AccesoDenegadoAuditado`). Cada entrada se guarda en su propia transacción y un fallo al guardarla no afecta a la respuesta. Se borran pasados `app.auditoria.dias` (365). Antes de guardarla, deja en el log la línea del SOC `evento=auditoria accion=... resultado=... ip=...`, sin usuario ni detalle ([seguridad.md](seguridad.md#5-soc-detección-y-alertas)); con Docker Compose el log va también en JSON a `/var/log/barhub/backend.log`.

| Método | Endpoint | Quién | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/auditoria?desde&hasta&usuario&accion&resultado&pagina&tamano` | Admin | Entradas del rango (por defecto, los últimos 7 días), de la más reciente a la más antigua, 50 por página (como mucho 100). `usuario` busca una parte del nombre sin distinguir mayúsculas |

### 3.6. Subida de imágenes (productos y perfiles)

| Control | Detalle |
| :--- | :--- |
| Extensión | Lista blanca: `jpg`, `jpeg`, `png`, `webp` |
| Tipo declarado | `Content-Type` de tipo `image/*` |
| Contenido real | Comprobación de la firma del archivo (magic bytes) |
| Tamaño | 5 MB por archivo y 6 MB por petición |
| Nombre | Generado por el servidor con sufijo aleatorio; nunca el del cliente |
| Ruta | Normalizada y comprobada dentro de la carpeta de destino |
| Sustitución y borrado | La imagen anterior se elimina solo tras guardar la nueva; también al borrar el registro |

### 3.6.1. Avisos en tiempo real · `/eventos`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/eventos/personal` | Empleados y administradores | Flujo `text/event-stream` con un aviso por cada cambio de un pedido, de sus líneas o de una mesa |
| `GET` | `/eventos/mis-pedidos` | Cualquier usuario con sesión | Solo los cambios de los pedidos de ese usuario |

Ver [Actualización de datos](#6-actualización-de-datos).

### 3.7. Avisos de la política de seguridad de contenido · `/csp-informe`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/csp-informe` | Público | El navegador avisa de lo que ha bloqueado la CSP de Caddy (`report-uri`). Se anota en el log con el prefijo `CSP:` (directiva, recurso bloqueado, página y fichero de origen). Lee como mucho 16 KB, recorta cada campo a 200 caracteres sin saltos de línea, anota como mucho 60 avisos por minuto y responde siempre `204` |

## 4. Roles y control de acceso

Se definen en la tabla `roles` (relación N:M con `users` mediante `user_roles`):

| Rol | Descripción |
| :--- | :--- |
| `role_cliente` | Usuario final: carta, pedidos y seguimiento |
| `role_empleado` | Personal: comandas, mesas, efectivo y caja |
| `role_admin` | Gerencia: gestión completa y métricas |

El acceso se aplica a dos niveles: **backend** (Spring Security con el JWT y los roles de `UserDetailsImpl`) y **frontend** (`auth.guard.ts` / `role.guard.ts`). El backend es la barrera real; los guardas del frontend solo mejoran la experiencia.

**Denegación por defecto.** `SecurityConfig` solo permite de forma explícita `/auth/**` y las lecturas públicas necesarias; cualquier otra ruta no declarada se rechaza (`anyRequest().denyAll()`). Las operaciones de escritura llevan además `@PreAuthorize` por rol. Los intentos de acceder a pedidos o perfiles ajenos reciben un `404` uniforme.

## 5. Ciclo de vida de un pedido

```mermaid
stateDiagram-v2
    [*] --> pendiente: POST /pedidos
    pendiente --> preparado: cocina termina
    preparado --> servido: sala entrega
    servido --> [*]
```

El **pago** sigue un flujo independiente (`estado_pago`):

```mermaid
stateDiagram-v2
    [*] --> pendiente
    pendiente --> completado: cobro confirmado
    pendiente --> rechazado: pago fallido
```

Los pagos en efectivo quedan `pendiente` hasta que un empleado los registra (`/pedidos/pendientes-efectivo`) y alimentan el cuadre de `/caja/cerrar`. Los pagos con tarjeta nacen `completado`, porque el pedido solo se crea cuando Stripe ha cobrado (ver [3.4.1](#341-pago-con-tarjeta--pagos)).

## 6. Actualización de datos

Las pantallas con estado cambiante (comandas, mesas, pagos en efectivo y el seguimiento del cliente) se actualizan con **Server-Sent Events** (paquete `tiemporeal`). El aviso solo dice qué ha cambiado (`event: pedido` o `event: mesa` y `data: {"id": 42}`); la pantalla vuelve a pedir los datos por los endpoints de siempre, que son los que comprueban los permisos. La base de datos sigue siendo la única fuente de la verdad.

```mermaid
sequenceDiagram
    participant Cl as Cliente
    participant API as Backend
    participant DB as MariaDB
    participant St as Empleado/Cocina

    St->>API: GET /eventos/personal (queda abierta)
    Cl->>API: GET /eventos/mis-pedidos (queda abierta)
    Cl->>API: POST /pedidos
    API->>DB: guarda pedido y detalles (commit)
    API-->>St: event: pedido {"id": 42}
    St->>API: GET /pedidos
    St->>API: PUT /pedidos/{id} (preparado)
    API->>DB: actualiza estado (commit)
    API-->>Cl: event: pedido {"id": 42}
    Cl->>API: GET /pedidos/mis-pedidos
```

| Pieza | Detalle |
| :--- | :--- |
| Origen de los avisos | `AvisoDeCambios`, un `@EntityListeners` de JPA en `Pedido`, `DetallePedido` y `Mesa`, publica un `CambioEnTiempoReal` al guardar o borrar. Así sale de cualquier ruta que cambie esos datos, sin tocar cada servicio |
| Envío | `EventosEnTiempoReal` lo recibe con `@TransactionalEventListener(phase = AFTER_COMMIT)`: un cambio que hace rollback no se avisa |
| Canales | `PERSONAL` recibe todo; `CLIENTE` solo los pedidos cuyo dueño es ese usuario |
| Sesión | Cada 25 s se manda un latido (comentario SSE, mantiene la conexión a través de proxies) y se comprueba que la sesión sigue abierta, sin contar como actividad. Al cerrar sesión, cambiar la contraseña, eliminar la cuenta o caducar, el servidor corta la conexión |
| Duración y límites | Cada conexión dura como mucho `app.tiempo-real.duracion` (5 min) y el navegador se vuelve a conectar con su token del momento. 5 conexiones por usuario (se cierra la más antigua) y `app.tiempo-real.maximo-conexiones` (500) en total; por encima, `503` |
| Hilos | `SseEmitter` usa el modo asíncrono de Spring MVC: una conexión abierta no ocupa un hilo de Tomcat. `SecurityConfig` deja pasar los despachos `ASYNC` porque la petición ya se autorizó al abrirla |
| Caddy | `reverse_proxy` entrega cada aviso al momento con `text/event-stream`, y `encode` no comprime ese tipo (comprimido llegaría a trozos) |

Con una sola instancia del backend basta con la memoria; con varias réplicas haría falta repartir los avisos con un broker compartido (por ejemplo, Redis).

## 7. Calidad del código

Tras la auditoría de SonarQube se aplicó este plan (detalle en [auditorias.md](auditorias.md)):

- Eliminado `e.printStackTrace()`; excepciones centralizadas con respuestas HTTP estandarizadas.
- `equals()` y `hashCode()` implementados juntos en `UserDetailsImpl`.
- `PedidoServiceImpl` refactorizado para reducir la complejidad cognitiva.
- Enumerados reubicados en `model/enums`.
- Migración de `new Date()` a `java.time` / `Instant`.
- Respuestas de error genéricas: el cliente no recibe detalles internos y la causa queda solo en el log del servidor.
- Validación de entrada con Bean Validation (`@Valid`) en los DTO, para rechazar datos incorrectos con un `400` en lugar de fallar al guardar.
- Denegación por defecto y `@PreAuthorize` en las operaciones de escritura (ver sección 4).
- Pruebas dinámicas de la API en ejecución, con sus resultados en [evidencias/](evidencias/seguridad-2026-11-22.md).
