# Changelog

Todos los cambios relevantes de BarHub se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

Primera versión 2.0 en preparación. Al publicarla, cambia este título por `[2.0.0] - AAAA-MM-DD` y crea la release con la etiqueta `v2.0.0`.

### Añadido
- Módulo de caja: apertura y cierre de turno con arqueo y control de descuadres.
- Confirmación de pagos en efectivo en tiempo real (barra y mesa).
- Panel de métricas: ingresos, productos más vendidos y horas pico.
- Verificación de correo electrónico en el registro.
- Páginas de política de privacidad y términos y condiciones.
- Pipeline de CI/CD del frontend con GitHub Actions, SonarCloud y publicación de la imagen en Docker Hub.
- Script de bastionado del sistema Linux (`seguridad/`).
- Documentación técnica con el modelo de datos y las auditorías.

### Cambiado
- Rediseño completo de la interfaz de cliente, personal y administración.
- Contrastes de color revisados para cumplir los mínimos de WCAG.
- Backend actualizado a Spring Boot 3.4.3.
- Librería JWT actualizada a jjwt 0.12.5 y adaptada a su API actual.
- Conectores de base de datos actualizados.
- Refactorización de servicios con alta complejidad (por ejemplo `PedidoServiceImpl`).

### Seguridad
- Auditoría de dependencias con Snyk (backend y frontend) y versiones parcheadas forzadas con `overrides`.
- Auditoría de calidad con SonarQube y resolución de las incidencias de seguridad y fiabilidad.
- Dockerfiles bastionados con Trivy: ejecución con usuario no root y `HEALTHCHECK`.
- Eliminadas las trazas por consola (`printStackTrace`) y centralizado el manejo de excepciones.

### Pendiente
- Primer análisis en SonarCloud y pipeline del backend.
- Despliegue en VPS con HTTPS y SOC automático.
- Migración de Angular a una versión con soporte.
