# Infraestructura de BarHub 2.0

Ficheros para levantar BarHub con Docker Compose, en local o en un servidor. La guía completa (requisitos, conexión SSH, variables de entorno, despliegue, Caddy, bastionado, pruebas de aceptación, CI/CD y monitorización) está en [`docs/infraestructura.md`](../docs/infraestructura.md); este README solo resume qué hay aquí.

| Ruta | Contenido |
| :--- | :--- |
| `docker/docker-compose.yml` | MariaDB, backend, frontend, Caddy, Mailpit y Uptime Kuma; DuckDNS con el perfil `prod` y el SOC (Loki, Alloy, Alertmanager y Grafana) con el perfil `soc` |
| `docker/.env.example` | Plantilla de variables, sin secretos. Se copia a `docker/.env`, que no se versiona |
| `docker/initdb/` | Primera arrancada de MariaDB: TLS obligatorio para el usuario de la aplicación |
| `caddy/Caddyfile` | Proxy inverso: `/api` al backend, imágenes subidas, HTTPS automático, cabeceras de seguridad y CSP |
| `mysql/docker-compose.yml` | MariaDB suelta en `127.0.0.1:3306`, para desarrollar el backend fuera de Docker Compose |
| `duckdns/logrotate.conf` | Rotación de los logs de DuckDNS |

```bash
cd infra/docker
cp .env.example .env                       # y rellenarlo
docker compose up -d --build               # local: http://localhost
docker compose --profile prod up -d --build  # servidor: HTTPS para SITE_ADDRESS y DuckDNS
docker compose ps
```

Solo Caddy publica puertos hacia fuera (`80` y `443`). Mailpit (`8025`), Uptime Kuma (`3001`) y el SOC escuchan solo en `127.0.0.1`; en el servidor se abren por un túnel SSH. El bastionado del sistema está en [`seguridad/hardening/`](../seguridad/hardening/README.md) y el SOC, en [`seguridad/soc/`](../seguridad/soc/README.md).
