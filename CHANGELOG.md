# Changelog

Todos los cambios relevantes de BarHub se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

Primera versión 2.0 en preparación. Al publicarla, cambia este título por `[2.0.0] - AAAA-MM-DD` y crea la release con la etiqueta `v2.0.0`.

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
- Script de bastionado del sistema Linux (`seguridad/`).
- Documentación técnica con el modelo de datos, las auditorías y las guías de uso.

### Cambiado
- Rediseño completo de la interfaz de cliente, personal y administración.
- Contrastes de color revisados para cumplir los mínimos de WCAG.
- Backend actualizado a Spring Boot 3.4.3.
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

### Pendiente
- Verificación de correo electrónico en el registro (hoy no se envía ni se exige).
- Verificación en servidor del pago con Stripe (hoy simulado en modo demostración).
- Límite de intentos en el login, caducidad más corta del JWT y contraseña actual al cambiarla.
- Primer análisis en SonarCloud y pipeline del backend.
- Despliegue en VPS con HTTPS y SOC automático.
- Migración de Angular a una versión con soporte.
