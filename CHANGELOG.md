# Changelog

Todos los cambios relevantes de BarHub se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Tests unitarios del frontend con Vitest: 22 tests de `ThemeService`, `RoleGuard`, `AuthInterceptor`, `DialogService` y `AppComponent`, incluido uno que comprueba que el toast no interpreta HTML y otro de regresión para la confirmación cancelada.
- CI: el pipeline ejecuta los tests del frontend con cobertura (si uno falla, el CI falla) y SonarCloud mide la cobertura del frontend además de la del backend. El análisis pasa a la versión `2.1.0`.

### Seguridad
- La conexión entre el backend y MariaDB va cifrada con TLS y con el certificado del servidor verificado: el driver MariaDB Connector/J 4 lo hace por defecto (`sslMode=verify-full`) y MariaDB 13 genera y valida su certificado sin configuración.
- Reanálisis de Snyk con las versiones nuevas: backend de 29 incidencias a 2 (ninguna crítica ni explotable, sin parche publicado) y frontend de 25 a 0. ASM, que solo usa JaCoCo para el informe de cobertura, pasa de la 9.8 a la 9.11.1 (cinco avisos medios), y `objenesis`, que solo usan los tests, de la 3.3 a la 3.6. El aviso XXE de `jaxb-core` se acepta con su justificación en `SECURITY.md`.
- El usuario de la aplicación queda obligado a usar TLS (`REQUIRE SSL`): una conexión sin cifrar se rechaza. En instalaciones nuevas lo aplica `infra/docker/initdb/10-tls-obligatorio.sh`; en las existentes se aplica una vez a mano.

### Cambiado
- Frontend: Angular 14 a **22**, versión a versión con `ng update` y sus migraciones oficiales (control flow `@if`/`@for`, `standalone: false` en los componentes de módulos, `ChangeDetectionStrategy.Eager` para conservar la detección de cambios anterior, `withXhr` en el cliente HTTP). TypeScript 4.8 a 6.0, zone.js 0.11 a 0.16 y Node 18 a 24 en Docker y en el CI. Cada salto se verificó con el build de producción y con capturas automáticas de las 36 pantallas en los dos temas.
- Frontend: el build pasa del builder `browser` (Webpack) al builder `application` (esbuild): compila en unos 15 segundos en lugar de 30 a 55. La salida pasa a `dist/barhub/browser`, y el Dockerfile copia desde ahí.
- Frontend: `pdfmake` y sus fuentes (cerca de 2 MB) se cargan solo al generar el ticket, con `import()` dinámico, en lugar de en el arranque. El bundle inicial baja de 2,80 MB a 1,13 MB (de 795 kB a 218 kB comprimido) y ya cumple el presupuesto de 2 MB.
- Frontend: los tests pasan de Karma y Jasmine (con Chrome) a Vitest con jsdom (sin navegador), con la migración oficial de Angular. Se retiran 166 paquetes, entre ellos la cadena `socket.io`/`ws` de Karma, y `npm audit` queda sin vulnerabilidades. `src/test.ts`, `karma.conf.js` y `src/polyfills.ts` sobran (los polyfills se declaran directamente como `zone.js`).
- Frontend: `tsconfig.json` sin las opciones que TypeScript 6 declara obsoletas: `baseUrl` pasa a `paths` (los imports `src/...` siguen igual), fuera `downlevelIteration` y `moduleResolution` pasa a `bundler`.
- Frontend: se quitan los `overrides` de `package.json`, que parcheaban las herramientas de Angular 14; con las versiones nuevas sobran. Dependabot pasa de 53 alertas abiertas a 1.
- Caddy: la regla que cachea un año los JS y CSS con hash reconoce los nombres de esbuild (`main-VMWQ63FG.js`).
- `DialogService` usa la API nativa de Bootstrap 5 (`Modal` y `Toast`) en lugar de jQuery. Los textos se insertan con `textContent`, sin interpretar HTML.
- Dependabot: comentarios de las reglas del frontend actualizados a Angular 22; deja de ignorar las versiones mayores de `@stripe/stripe-js`.
- Documentación: Angular 22 en el README, `docs/frontend.md`, `docs/README.md`, `docs/auditorias.md`, `docs/seguridad.md`, `SECURITY.md` y el README del frontend.
- Backend: Java 17 a 21 (toolchain de Gradle, imágenes `eclipse-temurin:21` y CI).
- Backend: driver `mariadb-java-client` 3.5.11 a 4.0.0, y Dependabot deja de ignorar sus versiones mayores.
- Documentación: versiones nuevas en el README, `docs/backend.md`, `docs/seguridad.md`, `docs/auditorias.md` e `infraestructura.md`; evidencia de la conexión cifrada con MariaDB; en `docs/seguridad.md` se corrigen datos desfasados (caducidad del JWT de 4 horas, bloqueo del login y contraseña actual, ya implementados en la 2.0.1).
- Backend: JJWT 0.12.5 a 0.13.0 en sus tres módulos a la vez; Dependabot los agrupa para que no vuelvan a separarse de versión.
- Backend: Spring Boot 3.5.16 a 4.2.0 (Spring Framework 7, Spring Security 7, Hibernate 7, Tomcat 11 y Jackson 3). Se mantiene Gradle 8.14.
- Backend: `spring-boot-starter-web` pasa a `spring-boot-starter-webmvc`, y los tests de MockMvc usan `spring-boot-starter-webmvc-test` con el nuevo paquete de `@AutoConfigureMockMvc`.
- Backend: Jackson 3 con `spring.jackson.use-jackson2-defaults`, para que la API siga respondiendo y aceptando el mismo JSON.
- Backend: JJWT serializa con Gson (`jjwt-gson`) en lugar de Jackson 2, que deja de estar en el classpath.
- Tests: `spring-security-test` pasa a `spring-boot-starter-security-test`, que en Spring Boot 4 es el que integra `@WithMockUser` con MockMvc.
- Backend: se quita `database-platform` de `application.yml`; Hibernate 7 detecta el dialecto de MariaDB solo.
- Backend: se quitan las versiones forzadas de Tomcat, Jackson, Logback e Hibernate Validator, que Spring Boot 4 ya trae corregidas.
- Dependabot: deja de ignorar las versiones mayores de Spring Boot.

### Eliminado
- Frontend: dependencias que no se usaban o estaban duplicadas, como paso previo a la migración de Angular: `@angular/material` y `@angular/cdk` (solo se cargaba su CSS `indigo-pink`), `@angular/animations` y `BrowserAnimationsModule` (no había animaciones), `@zxing/ngx-scanner` (sin uso), jQuery y el Popper suelto (ya va dentro de `bootstrap.bundle`).


### Corregido
- `AuthInterceptor`: ante un 401 (sesión caducada) redirigía a `/login`, una ruta que no existe, en lugar de a `/auth/login`, y no borraba `user` del almacenamiento, de modo que `isLoggedIn()` seguía devolviendo `true`.
- `index.html`: el idioma del documento pasa de `en` a `es`, para que los lectores de pantalla lean el contenido en español, y se cierra la etiqueta `</html>`, que estaba incompleta.
- `solicitarConfirmacion`: si se cancelaba una confirmación, su acción quedaba enganchada al botón Aceptar y se ejecutaba también en la siguiente.

## [2.0.3] - 2026-11-20

### Cambiado
- Tema oscuro rehecho sobre el modo de color nativo de Bootstrap 5.3 (`data-bs-theme`) con la paleta de BarHub en variables: las reglas que pisaban a Bootstrap con `!important` se sustituyen por sus variables (tarjetas, modales, tablas, formularios, botones, utilidades e insignias). El tema claro queda idéntico, comprobado con capturas automáticas de 36 pantallas en los dos temas.
- HTML: `text-dark`, `bg-light` y `bg-white` pasan a `text-body`, `bg-body-tertiary` y `bg-body`, que dan el mismo color en tema claro y se adaptan al oscuro (salvo `text-dark` sobre fondos de color, que se mantiene).
- Estilos: las 43 `transition: all` se sustituyen por las propiedades que realmente se animan.
- Accesibilidad: los anuncios para lectores de pantalla, el contador del carrito y los avisos usan `<output>`; las insignias del modo oscuro tienen fondo opaco con contraste AA.
- Backend: campos `final` en los DTO de respuesta y en `UserDetailsImpl`; test de la limpieza de registros de `LoginAttemptService`.
- Dependencias del build: overrides con versiones parcheadas de la misma rama para `@babel/core`, `@babel/runtime`, `postcss`, `minimatch` y `ajv` (este último solo en `@angular-devkit/core`).
- Hoja de ruta: la migración a Spring Boot 4 y a Angular 22 se adelanta de la 2.2 a la 2.1, antes de las funcionalidades nuevas. README actualizado con el stack real del frontend, el estado del pipeline, la cobertura y el bloqueo del login.
- SonarCloud: la cobertura se mide solo en el backend, que es el único con informe; el análisis lleva la versión real y excluye los datos SQL de demostración.

### Corregido
- Reglas oscuras del perfil que nunca se aplicaban (`body.dark-theme` dentro de un componente encapsulado por Angular); tarjetas de tipo de vivienda en modo oscuro.
- Secciones de formularios y barras del buscador del panel de administración, que salían grises en modo oscuro.
- Dos errores de CSS en el seguimiento de pedidos (`background` anulaba a `background-color`) y selectores duplicados.
- La lupa del buscador del panel ya usa el color de contraste revisado, que antes anulaba un `!important`.

### Notas
- Quedan 129 `!important` en el código (bloque de móvil, buscador y campo de archivo del panel, comandas, entre otros). SonarCloud dejó de contarlos al retirar esa regla de su perfil; se revisarán con la migración de Angular (2.1).
- El movimiento reducido se resuelve con una regla global; los avisos por componente de SonarCloud se aceptan con ese motivo.
- El frontend no tiene cobertura de tests medida en el CI; se incorporará en la 2.1, con la migración de Angular.
- La etiqueta `v2.0.2` incluye dos actualizaciones de Dependabot fusionadas después de su cierre (`@stripe/stripe-js` menor y jQuery 4.0.0); se ha comprobado que los diálogos que usan jQuery funcionan.
- Las alertas de dependencias que quedan son de Angular 14, sin soporte, y de herramientas de compilación que exigen un salto de versión mayor (ver `SECURITY.md`). Se dejan abiertas a propósito: se cierran con la migración de la 2.1.

## [2.0.2] - 2026-11-19

### Cambiado
- Dependencias: Gradle 8.14.7, las acciones de GitHub del pipeline (checkout, setup-java, setup-node, setup-buildx, login y build-push) y el grupo de actualizaciones menores del frontend (Bootstrap, Chart.js y pdfmake, entre otras).
- El dominio de producción ya no está escrito en el código: Caddy lo lee de `SITE_ADDRESS` (por defecto `http://localhost`, sin errores de certificado en local) y el backend toma los orígenes permitidos de `CORS_ALLOWED_ORIGINS`. En producción hay que definir ambas en el `.env`.
- `.gitignore`: los `.jar` compilados de `backend/` no se versionan.
- `SECURITY.md`: nueva sección de limitaciones conocidas con el análisis de las alertas de Angular 14 (sin soporte) y su exposición real. La migración está prevista en la 2.2.
- Dependabot: se ignoran las versiones mayores de las herramientas ligadas a Angular 14 (devkit, Karma, Jasmine, RxJS, zone.js y TypeScript) hasta la migración, y se elimina una regla duplicada.
- Carta: comentario que explica por qué el mapa incrustado usa `bypassSecurityTrustResourceUrl` (origen fijo y dirección codificada).
- Backend: JaCoCo se fija en la 0.8.13 para que el wrapper de Gradle 8.14 resuelva el agente de cobertura.
- Dependabot: se ignora el salto mayor del driver `mariadb-java-client` (4.x) hasta la migración prevista en la 2.2.
- Backend: `gradle.lockfile` regenerado (JaCoCo 0.8.13 y ASM 9.8), porque el bloqueo de dependencias estaba desfasado respecto a Spring Boot.
- Frontend: `zone.js` vuelve a la 0.11.8, la rama que admite Angular 14 (una actualización automática lo había subido a la 0.16, que `npm ci` rechaza sin `--legacy-peer-deps`).
- Dependabot: se ignoran los menores de `zone.js` y los mayores de `@zxing/ngx-scanner` y `@stripe/stripe-js`.
- Documentación: el ejemplo de Caddy de `docs/infraestructura.md` refleja las cabeceras y la variable `SITE_ADDRESS` reales, y `SECURITY.md` aclara que las alertas de solo desarrollo no afectan a lo que se sirve.

## [2.0.1] - 2026-11-18

### Añadido
- Tests del backend: servicios de pedidos, caja y mesas, utilidades JWT, registro e inicio de sesión, y matriz de permisos por rol (un cliente o un empleado no accede a las rutas de administración).
- Medición de cobertura con JaCoCo y envío del informe a SonarCloud desde la pipeline.
- Ejecución de los tests del backend en la pipeline de GitHub Actions.
- Bloqueo temporal del inicio de sesión: tras 5 intentos fallidos de un mismo usuario, el acceso se bloquea 15 minutos y la API responde 429 con la cabecera `Retry-After`.
- Para cambiar la propia contraseña ahora hay que indicar la actual. Un administrador puede restablecer la de otra persona sin conocerla.
- Sección "Cambiar contraseña" en el perfil del usuario.
- `infra/docker/.env.example` con las variables necesarias para el despliegue.

### Corregido
- La validación del token JWT devuelve "no válido" ante un token con firma falsa, en lugar de propagar la excepción.
- La fecha de los pedidos se guarda en la zona horaria de Madrid, igual que la caja. Con el servidor en UTC, el cierre de caja podía sumar mal las ventas recientes.
- Formato erróneo (`&s` en lugar de `%s`) en la dirección de casa del usuario.
- El inicio de sesión distingue credenciales incorrectas, bloqueo temporal y error del servidor, en lugar de mostrar siempre el mismo mensaje.
- Se eliminan los `console.log` del login que mostraban roles e identificador en la consola del navegador.
- El estado de las mesas en administración salía vacío en modo claro y el panel mostraba 0 mesas disponibles, porque la base de datos guarda el estado en mayúsculas.
- Los botones de iniciar sesión y registrarse de la home ya no aparecen con la sesión iniciada.
- `package-lock.json` del frontend regenerado (faltaban las dependencias de zxing, y la pipeline fallaba con `npm ci`) y correcciones automáticas de `npm audit fix`.

### Cambiado
- Accesibilidad: los iconos decorativos se ocultan a los lectores de pantalla y los botones de mostrar y ocultar la contraseña tienen nombre accesible.
- Accesibilidad: los avisos emergentes, el contador del carrito, los errores del formulario de registro y los cambios de estado en seguimiento de pedidos y comandas se anuncian a los lectores de pantalla.
- Accesibilidad: los mensajes de error del perfil se asocian a su campo para que los lea el lector de pantalla, y se respeta la preferencia de movimiento reducido del sistema (se apagan animaciones y transiciones).
- Modo oscuro: contraste revisado según WCAG AA en 12 pantallas (Mis pedidos, comandas, pagos en efectivo, mesas, carta, confirmación de pedido, perfil, registro, bienvenida de administración, tablas de administración, cabecera y home). Se corrigen textos casi ilegibles, como el icono de ordenar de las tablas y el botón de contorno de la home. El marco del código QR sigue en blanco para que se pueda escanear.
- Hojas de estilo sin selectores duplicados en los estilos del modo oscuro.
- Revisión visual en claro y oscuro de las pantallas públicas y de administración: colores unificados por tipo de pedido (mesa azul, recoger ámbar, domicilio morado) y por estado de mesa (disponible verde, ocupada roja, reservada azul); insignias de administración legibles en modo oscuro y sin la losa clara en las pantallas de gestión.
- `crearPedidoSeguro` dividido en métodos más pequeños, con el mismo comportamiento.
- Llamadas `subscribe` de Angular actualizadas al formato de objeto que recomienda RxJS.
- El token de sesión caduca a las 4 horas en lugar de a las 24.
- Al caducar la sesión se borran todos los datos guardados en el navegador (token, roles y usuario), no solo el token.
- `UsuarioController.update` dividido en métodos más pequeños, con el mismo comportamiento.
- Base de datos: un único conector (MariaDB) con su URL, driver y dialecto, y se elimina el de MySQL. Las fechas con hora se interpretan en UTC.
- Compose local de la base de datos: versión de la imagen fijada, puerto solo accesible desde el propio equipo y comprobación de estado.
- Variable del usuario de la base de datos unificada como `DB_USERNAME` (antes el backend leía `DB_USER` y la documentación y Docker usaban `DB_USERNAME`). Quien arranque el backend en local debe definir `DB_USERNAME`.
- `application.yml`: el bloque de actuator estaba mal sangrado dentro de `spring`. Se mueve al nivel superior; el comportamiento no cambia (solo `health`, sin detalles).
- Se elimina `infra/mysql/import.sql`, que no usaba nada, y la mención a un `import.sql` inexistente en `infra/README.md`.

## [2.0.0] - 2026-11-15

### Añadido
- Módulo de caja: apertura y cierre de turno con arqueo y control de descuadres.
- Confirmación de pagos en efectivo en barra y mesa.
- Panel de métricas: ingresos, productos más vendidos y horas pico.
- Páginas de política de privacidad y términos y condiciones.
- Datos de demostración opcionales (`APP_SEED_DEMO`): 19 productos, 10 mesas y un administrador inicial cuya contraseña se define por variable de entorno.
- Aviso de modo demostración en el pago con tarjeta.
- Pruebas de seguridad dinámicas de la API, con sus resultados en `docs/evidencias/`.
- `Caddyfile` propio del frontend con política de caché para los bundles y reescritura de rutas de la SPA.
- Pipeline de CI/CD del frontend con GitHub Actions, SonarCloud y publicación de la imagen en Docker Hub.
- Primer análisis en SonarCloud: seguridad A, fiabilidad A y mantenibilidad A, con el Quality Gate superado sobre el código posterior a la versión 2.0.0 (`sonar.projectVersion`).
- Script de bastionado del sistema Linux (`seguridad/`).
- Documentación técnica con el modelo de datos, las auditorías y las guías de uso.

### Cambiado
- Rediseño completo de la interfaz de cliente, personal y administración.
- Contrastes de color revisados para cumplir los mínimos de WCAG.
- Backend actualizado a Spring Boot 3.5.16, con Tomcat, Jackson, Logback, Hibernate Validator y el conector de MariaDB fijados por encima del BOM por avisos de seguridad.
- Endurecimiento del pipeline y de los contenedores: acciones de GitHub fijadas por SHA, permisos mínimos del workflow, `npm ci --ignore-scripts`, `gradle.lockfile` para bloquear versiones y contenedor del frontend sin usuario root.
- Expresiones regulares de validación de correo y de nombre de imagen reescritas sin retrocesos excesivos, y navegaciones del editor de mesas marcadas como no esperadas.
- Librería JWT actualizada a jjwt 0.12.5 y adaptada a su API actual.
- Conectores de base de datos actualizados.
- Refactorización de servicios con alta complejidad (por ejemplo `PedidoServiceImpl`).
- Docker Compose: versiones de imagen fijadas, DuckDNS solo con el perfil `prod` y Stripe opcional, de modo que el proyecto arranca en local sin credenciales externas.
- El perfil valida los campos y muestra qué falta por rellenar.
- Política de privacidad y README ajustados a las funcionalidades reales.

### Seguridad
- Denegación por defecto en Spring Security (`anyRequest().denyAll()`) y `@PreAuthorize` por rol en las operaciones de escritura.
- Subida de imágenes endurecida en productos y perfiles: lista blanca de extensiones, tipo declarado, firma real del archivo, límites de tamaño, nombre aleatorio, ruta normalizada y borrado seguro.
- Respuestas de error genéricas: el detalle queda solo en el log del servidor.
- Validación de entrada con Bean Validation en los DTO.
- Acceso a datos ajenos (IDOR) con respuesta `404` uniforme y precios recalculados en el servidor.
- CORS limitado a los orígenes del frontend.
- Auditoría de dependencias con Snyk (backend y frontend) y versiones parcheadas forzadas con `overrides`.
- Auditoría de calidad con SonarQube y resolución de las incidencias de seguridad y fiabilidad.
- Dockerfiles bastionados con Trivy: ejecución con usuario no root y `HEALTHCHECK`.
- Eliminadas las trazas por consola (`printStackTrace`) y centralizado el manejo de excepciones.

### Eliminado
- Dependencia `spring-boot-starter-mail`, sin uso.
- Controlador de pruebas `TestController` y la ruta `/api/auth/**` redundante en la configuración de seguridad.
- Método sin uso de borrado automático de pedidos en el seguimiento del cliente.
- Referencias a puntos de fidelización en la política de privacidad.
- Componente de verificación de correo del frontend, sin backend que lo respalde.

### Pendiente
- Verificación de correo electrónico en el registro (hoy no se envía ni se exige).
- Verificación en servidor del pago con Stripe (hoy simulado en modo demostración).
- Límite de intentos en el login, caducidad más corta del JWT y contraseña actual al cambiarla.
- Pipeline del backend (compilación, tests y cobertura) y envío de informes de cobertura a SonarCloud.
- Avisos de accesibilidad de SonarCloud (imágenes sin texto alternativo) y revisión de la duplicación.
- Despliegue en VPS con HTTPS y SOC automático.
- Migración a Spring Boot 4 y a una versión de Angular con soporte, para corregir los avisos de dependencias que no tienen parche compatible.
