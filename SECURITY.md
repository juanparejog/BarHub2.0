# Política de seguridad

BarHub 2.0 es un proyecto personal en el que la seguridad es una parte importante del diseño. Si encuentras una vulnerabilidad, te agradezco que me la comuniques de forma responsable.

## Versiones con soporte

| Versión | Soporte de seguridad |
| :--- | :---: |
| 2.x (rama `main`) | Sí |
| 1.x | No |

## Cómo reportar una vulnerabilidad

**No abras un issue público** con los detalles de una vulnerabilidad.

Usa uno de estos canales:

1. **Informe privado en GitHub:** pestaña *Security* del repositorio, *Report a vulnerability*.
2. **Correo:** juanparejotrabajo@gmail.com, con el asunto `[SECURITY] BarHub`.

Incluye, si puedes:

- descripción del problema y componente afectado (backend, frontend, infraestructura);
- pasos para reproducirlo o una prueba de concepto;
- impacto que consideras que tiene;
- tu nombre o alias, si quieres que te mencione en los agradecimientos.

## Qué puedes esperar

Es un proyecto mantenido por una sola persona, así que me comprometo a hacer un esfuerzo razonable:

- **Confirmación de recepción:** en un plazo aproximado de 7 días.
- **Valoración y plan de corrección:** en cuanto lo haya analizado, te iré informando del estado.
- **Divulgación coordinada:** te pido que no publiques los detalles hasta que exista una corrección o hayan pasado 90 días desde el reporte.

## Alcance

**Dentro del alcance**
- Código del backend y del frontend de este repositorio.
- Configuración de contenedores, `docker-compose.yml`, `Caddyfile` y script de bastionado.

**Fuera del alcance**
- Servicios de terceros (Stripe, Docker Hub, proveedores de hosting...).
- Ingeniería social y ataques físicos.
- Denegación de servicio volumétrica.
- Vulnerabilidades de dependencias ya conocidas y documentadas como deuda técnica en el README.

## Pruebas permitidas

Realiza las pruebas **solo en tu propia instancia local**. No ataques servidores desplegados sin autorización expresa por escrito.

## Limitaciones conocidas

**Frontend en Angular 14 (sin soporte).** El frontend usa Angular 14, que ya no recibe correcciones de seguridad. Las alertas de dependencias que afectan a `@angular/common`, `@angular/compiler`, `@angular/core` y `@angular/router` solo se resuelven migrando a una versión con soporte, lo que implica varios saltos de versión mayor. Esa migración está prevista para la versión 2.1, antes de las funcionalidades nuevas. Hasta entonces, las alertas se dejan abiertas a propósito en Dependabot como recordatorio.

Análisis a fecha de 18 de noviembre de 2026, a partir del código de este repositorio. Los avisos abiertos en producción se agrupan así:

| Grupo de avisos | ¿Afecta a BarHub? | Motivo |
| :--- | :---: | :--- |
| Renderizado en servidor, hidratación y `HttpTransferCache` | No | El frontend es estático, servido por Caddy, sin SSR ni hidratación |
| `formatDate` y `digitsInfo` (consumo de memoria) | No | Los formatos de fecha y número son literales, no vienen del usuario |
| Fuga del token XSRF por URLs relativas al protocolo | No | La sesión usa JWT en la cabecera `Authorization`, no la cookie XSRF de Angular |
| XSS en i18n de Angular | No, por ahora | No se usa la internacionalización de Angular; se revisará si se adopta |
| Saltos de sanitización (SVG, MathML, bindings) | Sin uso de riesgo | No hay `innerHTML` ni componentes dinámicos con contenido del usuario |

El único uso de `bypassSecurityTrustResourceUrl` es el mapa de la ubicación del local: el origen de la URL es fijo (`maps.google.com`) y la dirección se codifica con `encodeURIComponent`, de modo que un usuario no puede cambiar el servidor ni el protocolo del `iframe`.

Las alertas marcadas como de desarrollo (por ejemplo `piscina` o `tar`, que llegan con Angular CLI y las herramientas de compilación) no forman parte de lo que se sirve a los usuarios: solo afectan al equipo que compila. Se resuelven con la misma migración prevista en la 2.1.

Mitigaciones en el despliegue: cabeceras `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` desde Caddy, y el actuator no accesible desde fuera de la red de Docker.

Esta tabla se revisa cada vez que se actualice Angular o se añada SSR, internacionalización, `innerHTML` o componentes dinámicos.
