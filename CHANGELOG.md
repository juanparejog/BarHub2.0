# Changelog

Todos los cambios relevantes de BarHub se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

Versión 2.0.1 en preparación.

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

### Cambiado
- Accesibilidad: los iconos decorativos se ocultan a los lectores de pantalla y los botones de mostrar y ocultar la contraseña tienen nombre accesible.
- `crearPedidoSeguro` dividido en métodos más pequeños, con el mismo comportamiento.
- Llamadas `subscribe` de Angular actualizadas al formato de objeto que recomienda RxJS.
- El token de sesión caduca a las 4 horas en lugar de a las 24.
- Al caducar la sesión se borran todos los datos guardados en el navegador (token, roles y usuario), no solo el token.
- `UsuarioController.update` dividido en métodos más pequeños, con el mismo comportamiento.
- Base de datos: un único conector (MariaDB) con su URL, driver y dialecto, y se elimina el de MySQL. Las fechas con hora se interpretan en UTC.
- Compose local de la base de datos: versión de la imagen fijada, puerto solo accesible desde el propio equipo y comprobación de estado.

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
