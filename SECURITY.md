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
