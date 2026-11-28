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
- Configuración de contenedores, `docker-compose.yml`, `Caddyfile`, script de bastionado y configuración del SOC.

**Fuera del alcance**
- Servicios de terceros (Stripe, Docker Hub, proveedores de hosting...).
- Ingeniería social y ataques físicos.
- Denegación de servicio volumétrica.
- Vulnerabilidades de dependencias ya conocidas y aceptadas en esta política y en [`docs/auditorias.md`](docs/auditorias.md).

## Pruebas permitidas

Realiza las pruebas **solo en tu propia instancia local**. No ataques servidores desplegados sin autorización expresa por escrito.

## Limitaciones conocidas

**Dependencias del frontend.** Desde la versión 2.1 el frontend usa Angular 22, con soporte activo, compilado con esbuild. La migración desde Angular 14 (sin soporte) se hizo versión a versión con las migraciones oficiales y cerró las alertas de Dependabot: de 53 abiertas a 0 (revisado el 28 de noviembre de 2026). Snyk no encuentra ninguna en el frontend ni en los E2E.

**Dependencias del backend.** Desde la versión 2.1 el backend usa Spring Boot 4.2. Los reanálisis de Snyk del 21 y del 28 de noviembre de 2026 dejan dos avisos sin parche publicado, aceptados:

- `org.glassfish.jaxb:jaxb-core` 4.0.9, XXE (alta). El aviso de `jaxb-core` (XXE) exige que la aplicación lea un XML enviado desde fuera, y BarHub no lo hace: ningún código usa JAXB (`@XmlRootElement`, `Unmarshaller` ni `application/xml`), no hay archivos `orm.xml` (Hibernate lee el mapeo de las anotaciones) y el conversor JAXB que registra Spring solo actúa sobre clases con `@XmlRootElement`, que la API no tiene; además, Spring desactiva por defecto las entidades externas.
- `jakarta.validation:jakarta.validation-api` 3.1.1 (baja): la corrección solo existe en una versión preliminar (4.0.0-M1); se actualizará cuando Spring Boot la adopte.

El único uso de `bypassSecurityTrustResourceUrl` es el mapa de la ubicación del local: el origen de la URL es fijo (`maps.google.com`) y la dirección se codifica con `encodeURIComponent`, de modo que un usuario no puede cambiar el servidor ni el protocolo del `iframe`.

Las herramientas de desarrollo (Angular CLI, Vitest) no forman parte de lo que se sirve a los usuarios: solo afectan al equipo que compila. Al sustituir Karma por Vitest desapareció la cadena `socket.io`/`ws` que arrastraba, y `npm audit` del frontend queda sin vulnerabilidades conocidas.

Mitigaciones en el despliegue: cabeceras `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` y una `Content-Security-Policy` estricta desde Caddy, y el actuator no accesible desde fuera de la red de Docker.

La internacionalización de la 2.1 no usa `innerHTML`: los textos se interpolan con la tubería `t`, que Angular escapa. Esta sección se revisa cada vez que se actualice Angular o se añada SSR, `innerHTML` o componentes dinámicos.
