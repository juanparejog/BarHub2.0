# Infraestructura

Procedimiento de despliegue de la arquitectura multi-contenedor de **BarHub 2.0**, acceso remoto seguro por SSH, endurecimiento (*hardening*) del servidor, automatización CI/CD y monitorización de seguridad (SOC).

## Índice

1. [Arquitectura de despliegue](#1-arquitectura-de-despliegue)
2. [Estructura de ficheros](#2-estructura-de-ficheros)
3. [Requisitos previos](#3-requisitos-previos)
4. [Preparación del servidor](#4-preparación-del-servidor)
5. [Conexión SSH segura](#5-conexión-ssh-segura)
6. [Repositorio y variables de entorno](#6-repositorio-y-variables-de-entorno)
7. [Orquestación y despliegue](#7-orquestación-y-despliegue)
8. [Contenedores y proxy (Docker y Caddy)](#8-contenedores-y-proxy-docker-y-caddy)
9. [Endurecimiento del sistema (hardening)](#9-endurecimiento-del-sistema-hardening)
10. [Pruebas de aceptación](#10-pruebas-de-aceptación)
11. [CI/CD con GitHub Actions](#11-cicd-con-github-actions)
12. [SOC y monitorización](#12-soc-y-monitorización)
13. [Mejoras recomendadas](#13-mejoras-recomendadas)

---

## 1. Arquitectura de despliegue

```mermaid
flowchart LR
    ADM["Administrador"] -- "SSH :22022<br/>clave pública" --> HOST
    USR["Usuarios"] -- "HTTPS :443" --> CADDY

    subgraph HOST["Servidor Linux (Debian 12 / Ubuntu LTS) · iptables + auditd + aide"]
        CADDY["barhub-caddy<br/>proxy inverso + TLS"]
        FE["barhub-frontend<br/>Angular"]
        BE["barhub-backend<br/>Spring Boot"]
        DB[("barhub-mysql<br/>MariaDB")]
        DDNS["barhub-duckdns<br/>actualiza la IP"]
        UK["barhub-uptime-kuma<br/>monitorización (127.0.0.1:3001)"]

        CADDY --> FE
        CADDY -- "/api" --> BE
        BE --> DB
    end

    DDNS -. "registro DNS" .-> DNS(("DuckDNS<br/>barhub2.duckdns.org"))
    UK -. "comprueba" .-> CADDY
```

| Contenedor | Función | Expuesto al exterior |
| :--- | :--- | :---: |
| `barhub-caddy` | Proxy inverso, HTTPS automático y servidor de entrada | 80 / 443 |
| `barhub-frontend` | Aplicación Angular | Vía Caddy |
| `barhub-backend` | API REST (Spring Boot) | Vía Caddy |
| `barhub-mysql` | Base de datos MariaDB | Solo red interna |
| `barhub-duckdns` | Mantiene actualizado el registro DNS dinámico (solo con el perfil `prod`) | No |
| `barhub-mailpit` | Captura los correos de la aplicación en local y en las pruebas; no entrega ninguno | No (solo `127.0.0.1:8025`) |
| `barhub-uptime-kuma` | Panel de monitorización de disponibilidad | No (solo `127.0.0.1:3001`) |
| `barhub-loki`, `barhub-alloy`, `barhub-alertmanager`, `barhub-grafana` | SOC: recogida de logs, reglas de alerta, avisos y panel (solo con el perfil `soc`, [`seguridad/soc`](../seguridad/soc/README.md)) | No (solo `127.0.0.1`) |

Puertos abiertos en el cortafuegos tras el bastionado: **`22022`** (SSH), **`80`** y **`443`**. Los paneles (Uptime Kuma, Mailpit y los del SOC) solo escuchan en `127.0.0.1` y se abren por un túnel SSH.

## 2. Estructura de ficheros

```text
BarHub2.0/
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml   Orquestación: 6 servicios siempre, DuckDNS con el perfil `prod` y 4 del SOC con el perfil `soc`
│   │   ├── initdb/              Primera arrancada de MariaDB: TLS obligatorio para el usuario de la aplicación
│   │   ├── .env.example         Plantilla de variables (sin secretos)
│   │   └── .env                 Credenciales reales (NO se versiona)
│   ├── caddy/
│   │   └── Caddyfile            Enrutamiento y proxy inverso
│   ├── mysql/                   MariaDB suelta, para desarrollar el backend fuera de Docker Compose
│   ├── duckdns/                 Rotación de los logs de DuckDNS
│   └── README.md                Guía de despliegue
└── seguridad/
    ├── hardening/               Script de bastionado del sistema
    └── soc/                     SOC: reglas de Loki, Alloy, Grafana y soc.py (despliegue y prueba)
```

## 3. Requisitos previos

| Requisito | Detalle |
| :--- | :--- |
| Sistema operativo | Linux: **Debian 12** o **Ubuntu LTS** |
| Acceso administrativo | Canal SSH seguro (ver [sección 5](#5-conexión-ssh-segura)) |
| Dominio | Operativo, p. ej. `barhub2.duckdns.org`, con registro **A/AAAA** apuntando a la IP pública del servidor |
| Credenciales | Parámetros confidenciales preparados de antemano (ver [sección 6](#6-repositorio-y-variables-de-entorno)) |
| Puertos accesibles | `80` y `443` desde Internet (necesarios para emitir el certificado TLS) |

## 4. Preparación del servidor

**1. Actualizar el sistema**

```bash
apt update && apt upgrade -y
```

**2. Crear un usuario con privilegios administrativos**

Por seguridad operativa se usa un usuario dedicado en lugar de `root`:

```bash
adduser barhubadmin
usermod -aG sudo barhubadmin
```

## 5. Conexión SSH segura

El acceso remoto se realiza **únicamente con criptografía asimétrica** sobre un puerto personalizado (`22022`). Cambiar el puerto no es una defensa por sí mismo, solo reduce el ruido de los escaneos automáticos; la protección real es desactivar la contraseña y exigir clave.

```mermaid
sequenceDiagram
    participant PC as Administrador
    participant SRV as Servidor :22022

    PC->>SRV: ssh -p 22022
    SRV->>PC: desafío con clave pública autorizada
    PC->>SRV: firma con clave privada
    SRV-->>PC: sesión establecida
```

### 5.1. Entorno de laboratorio (máquina virtual en NAT)

Esta sección solo se aplica a las pruebas en una máquina virtual con red NAT. En un VPS con IP pública se conecta directamente al puerto `22022`.

- Se configura **Port Forwarding** en el hipervisor.
- El tráfico al puerto **`22022`** de la interfaz local se redirige al puerto **`22022`** del servidor invitado.

### 5.2. Generación del par de claves

En el equipo cliente:

```cmd
ssh-keygen -t ed25519
```

| Fichero (`~/.ssh/`) | Descripción |
| :--- | :--- |
| `id_ed25519` | **Clave privada**. Estrictamente confidencial, nunca se comparte ni se sube al repositorio |
| `id_ed25519.pub` | **Clave pública**. Es la que se instala en el servidor |

> RSA de 4096 bits (`ssh-keygen -t rsa -b 4096`) también es válido. En ese caso los ficheros se llaman `id_rsa` e `id_rsa.pub`.

### 5.3. Autorización de la clave en el servidor

El servidor tiene desactivada la contraseña (`PasswordAuthentication no`), por lo que solo entra quien presente una clave autorizada.

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys      # pegar aquí el contenido de la clave pública

chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

> **Importante:** hay que instalar la clave pública **antes** de aplicar el bastionado o de desactivar las contraseñas. Si se hace al revés, se pierde el acceso al servidor.

### 5.4. Ejecutar la conexión

```bash
ssh -i ~/.ssh/id_ed25519 -p 22022 barhubadmin@<IP_SERVIDOR>
```

## 6. Repositorio y variables de entorno

**1. Clonar el repositorio**

```bash
git clone https://github.com/juanparejog/BarHub2.0.git
cd BarHub2.0/infra/docker
```

**2. Crear el fichero `.env`** a partir de la plantilla:

```bash
cp .env.example .env
nano .env
```

```env
# Base de datos
DB_DATABASE=barhub
DB_USERNAME=barhub_user
DB_PASSWORD=contrasena_usuario_segura
MYSQL_ROOT_PASSWORD=contrasena_root_muy_segura

# Backend
JWT_SECRET=secreto-aleatorio-de-al-menos-32-bytes

# Opcional: pago con tarjeta con Stripe, claves de PRUEBAS (sin ellas, solo efectivo)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=

# Solo producción (perfil prod)
DUCKDNS_DOMAINS=barhub2
DUCKDNS_TOKEN=tu-token-de-duckdns-aqui

# Opcional: datos de demostración y administrador inicial
APP_SEED_DEMO=false
APP_SEED_ADMIN_USERNAME=admin
APP_SEED_ADMIN_PASSWORD=
```

| Variable | Descripción |
| :--- | :--- |
| `DB_DATABASE` | Nombre de la base de datos |
| `DB_USERNAME` / `DB_PASSWORD` | Usuario y contraseña que usa el backend |
| `MYSQL_ROOT_PASSWORD` | Contraseña del usuario `root` de la base de datos |
| `DUCKDNS_DOMAINS` | Solo producción. Subdominio registrado (sin `.duckdns.org`) |
| `SITE_ADDRESS` | Solo producción. Dominio completo (por defecto `http://localhost`, sin HTTPS) |
| `CORS_ALLOWED_ORIGINS` | Solo producción. Orígenes permitidos por el backend, separados por comas |
| `DUCKDNS_TOKEN` | Solo producción. Token de tu cuenta de DuckDNS |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Opcionales. Claves de **pruebas** de Stripe (`sk_test_...` y `pk_test_...`, en *dashboard.stripe.com/test/apikeys*). Sin ellas, la carta solo ofrece pagar en efectivo. Las claves reales se rechazan mientras `app.pagos.solo-pruebas` sea `true` |
| `JWT_SECRET` | Secreto de firma de los tokens JWT |
| `APP_TOTP_CLAVE` | Clave para cifrar los secretos de la verificación en dos pasos (`openssl rand -base64 32`). Vacía, se deriva de `JWT_SECRET`. Si cambia, quien tenga la verificación activada la tiene que configurar de nuevo |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_STARTTLS`, `APP_CORREO_REMITENTE` | Solo producción. SMTP real para los correos de la aplicación (confirmación, recuperación, cambio de correo y avisos). Sin ellas, los correos van a Mailpit (`http://localhost:8025`) |
| `CSP_CABECERA` | Opcional. `Content-Security-Policy-Report-Only` deja la CSP solo en modo aviso, para probar un cambio sin romper nada |
| `SOC_*` | Solo con el perfil `soc`: usuario y contraseña de Grafana, SMTP y destinatario de las alertas y, opcionalmente, Telegram ([`seguridad/soc/README.md`](../seguridad/soc/README.md)) |
| `APP_SEED_DEMO` | `true` carga 19 productos y 10 mesas de ejemplo si la base de datos está vacía |
| `APP_SEED_ADMIN_USERNAME` / `APP_SEED_ADMIN_PASSWORD` | Administrador inicial (solo con `APP_SEED_DEMO=true` y si no existe ninguno). La contraseña debe tener al menos 8 caracteres |

> `.env` **nunca** se sube a Git: está en `.gitignore`. Usa contraseñas largas y únicas, genera los secretos con `openssl rand -base64 32` y trata el token de DuckDNS y la clave de Stripe como credenciales.

**3. Validar la estructura**

| Componente | Ruta |
| :--- | :--- |
| Orquestación Docker | `infra/docker/docker-compose.yml` |
| Enrutamiento y proxy | `infra/caddy/Caddyfile` |
| Plantilla de variables | `infra/docker/.env.example` |

## 7. Orquestación y despliegue

**1. Levantar la infraestructura**

En local (sin DuckDNS, la aplicación responde en `http://localhost`):

```bash
cd infra/docker
docker compose up -d --build
```

En producción (incluye DuckDNS y HTTPS para el dominio):

```bash
cd infra/docker
docker compose --profile prod up -d --build
```

**2. Auditar el estado**

```bash
docker compose ps
```

Deben aparecer en ejecución `barhub-mysql`, `barhub-backend`, `barhub-frontend`, `barhub-caddy`, `barhub-mailpit` y `barhub-uptime-kuma` (seis en local) y, con el perfil `prod`, también `barhub-duckdns` (siete). El SOC se arranca aparte, con `seguridad/soc/soc.py desplegar --aplicar`.

**3. Verificar los certificados TLS (solo producción)**

```bash
docker logs -f barhub-caddy
```

Debe verse la emisión automática del certificado para el dominio.

**Modo demostración (opcional)**

Con `APP_SEED_DEMO=true` y una `APP_SEED_ADMIN_PASSWORD` en el `.env`, el primer arranque con la base de datos vacía carga el catálogo de ejemplo y crea el usuario administrador. En arranques posteriores no duplica nada. Es lo que usa un revisor para ver la aplicación con datos sin preparar nada más.

**Operaciones habituales**

| Acción | Comando |
| :--- | :--- |
| Ver logs de un servicio | `docker logs -f barhub-backend` |
| Reiniciar un servicio | `docker compose restart backend` |
| Actualizar tras un `git pull` | `docker compose up -d --build` |
| Parar todo | `docker compose down` |
| Parar y borrar datos | `docker compose down -v` (elimina los volúmenes) |

## 8. Contenedores y proxy (Docker y Caddy)

### 8.1. Imágenes Docker

| Imagen | Detalle |
| :--- | :--- |
| Frontend | Multi-etapa: **Node.js** compila Angular y **Caddy** sirve los estáticos |
| Backend | Multi-etapa con Gradle |
| Bastionado de ambas | Usuario **no root** (DS-0002) y `HEALTHCHECK` (DS-0026). Trivy: **0 incidencias** ([auditorias.md](auditorias.md#3-trivy)) |

### 8.2. Docker Compose (extracto)

Todos los servicios están en la red interna `barhub-net`. Solo Caddy publica puertos hacia fuera; Mailpit, Uptime Kuma y el SOC, solo en `127.0.0.1`. Las versiones de las imágenes están fijadas. El fichero completo está en [`infra/docker/docker-compose.yml`](../infra/docker/docker-compose.yml); este extracto es orientativo.

```yaml
services:
  mysql:
    image: mariadb:13.0
    container_name: barhub-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?}
      MYSQL_DATABASE: ${DB_DATABASE:?}
      MYSQL_USER: ${DB_USERNAME:?}
      MYSQL_PASSWORD: ${DB_PASSWORD:?}
    volumes:
      - mysql_data:/var/lib/mysql
      # Primera arrancada: TLS obligatorio para el usuario de la aplicación
      - ./initdb:/docker-entrypoint-initdb.d:ro

  backend:
    build: ../../backend
    container_name: barhub-backend
    # Además de la conexión a la base de datos recibe JWT_SECRET, APP_TOTP_CLAVE,
    # las claves de Stripe (opcionales), el SMTP (MAIL_*) y las variables APP_SEED_*.
    depends_on:
      mysql:
        condition: service_healthy

  frontend:
    build: ../../frontend
    container_name: barhub-frontend

  caddy:
    image: caddy:2.11-alpine
    container_name: barhub-caddy
    ports:
      - "80:80"
      - "443:443"

  duckdns:
    image: lscr.io/linuxserver/duckdns:8aabc87c-ls95
    container_name: barhub-duckdns
    profiles: ["prod"]

  mailpit:
    image: axllent/mailpit:v1.33.1
    container_name: barhub-mailpit
    ports:
      - "127.0.0.1:8025:8025"

  uptime-kuma:
    image: louislam/uptime-kuma:1.23.17
    container_name: barhub-uptime-kuma
    ports:
      - "127.0.0.1:3001:3001"
```

**Conexión cifrada con la base de datos.** MariaDB 13 genera su propio certificado al arrancar, y el driver del backend (Connector/J 4) cifra la conexión con TLS y verifica ese certificado durante el login, sin configurar nada. Además, el usuario de la aplicación tiene el TLS obligatorio (`REQUIRE SSL`):

- En una instalación nueva lo aplica `infra/docker/initdb/10-tls-obligatorio.sh`, que MariaDB ejecuta solo al crear el volumen de datos.
- En una instalación existente se aplica una vez a mano:

```bash
docker exec barhub-mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mariadb -uroot -h127.0.0.1 -e "ALTER USER \"$MYSQL_USER\"@\"%\" REQUIRE SSL;"'
docker compose restart backend
```

La comprobación está en [evidencias/tls-mariadb-2026-11-20.md](evidencias/tls-mariadb-2026-11-20.md).

> Lo que aún se endurecerá (`no-new-privileges` y `cap_drop` en los contenedores de la aplicación, que hoy solo llevan los del SOC) está en la [sección 13](#13-mejoras-recomendadas).

### 8.3. Caddy

Caddy es el único punto de entrada web: reenvía la API al backend, entrega la SPA a través del contenedor del frontend y gestiona el **HTTPS automático** (emisión y renovación de certificados) del dominio de producción. En local la aplicación responde en `http://localhost`, sin certificado.

El fichero real es [`infra/caddy/Caddyfile`](../infra/caddy/Caddyfile) y es la referencia; no se copia aquí para que no quede desactualizado. Resumen de las rutas:

| Ruta | Destino |
| :--- | :--- |
| `/api/*` | `backend:8080`, quitando el prefijo `/api` antes de reenviar. Los avisos en tiempo real (`/api/eventos/*`, `text/event-stream`) pasan al momento y sin comprimir |
| Imágenes subidas | Ruta propia definida en el mismo fichero |
| Resto | `frontend:80` (SPA) |

El contenedor del frontend lleva su propio `Caddyfile` (caché de los bundles con hash y reescritura de rutas de la SPA).

## 9. Endurecimiento del sistema (hardening)

Fase final del despliegue: un script automatizado endurece el sistema operativo **preservando las interfaces de red virtuales de Docker**.

```bash
sudo python3 seguridad/hardening/hardening-linux.py
```

> **Importante:** despliega primero los contenedores (sección 7) y comprueba que tu clave SSH funciona. Mantén **otra sesión SSH abierta** mientras se aplica el script, por si algo bloquea el acceso.

### 9.1. Directivas aplicadas

| Área | Medida | Objetivo |
| :--- | :--- | :--- |
| **Contraseñas y PAM** | Complejidad estricta y políticas de caducidad | Evitar credenciales débiles |
| **Kernel (`sysctl`)** | Mitigación de ataques de red comunes, manteniendo los parámetros que necesita el enrutamiento de contenedores | Reducir superficie de ataque sin romper Docker |
| **Auditoría (`auditd`)** | Reglas de supervisión estricta | Trazabilidad de acciones sensibles |
| **Integridad (`aide`)** | Control de integridad de ficheros | Detectar modificaciones no autorizadas |
| **SSH** | Puerto `22022`, acceso directo de `root` restringido, sesiones concurrentes limitadas, sin contraseña | Proteger el acceso remoto |
| **Cortafuegos (Netfilter / iptables)** | Reglas restrictivas de entrada sobre `22022`, `80` y `443`, sin tocar las cadenas NAT de Docker | Exponer solo lo imprescindible |

### 9.2. Configuración SSH resultante

```text
# /etc/ssh/sshd_config
Port 22022
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 2
```

### 9.3. Por qué se respeta Docker

Docker gestiona sus propias cadenas de `iptables` (NAT y reenvío). Un bastionado agresivo que vacíe las reglas dejaría los contenedores sin red. Por eso el script **solo consolida la cadena de entrada** y deja intactas las de Docker.

### 9.4. Verificaciones posteriores

```bash
sudo iptables -L INPUT -n --line-numbers   # reglas de entrada
sudo ss -tlnp                              # puertos en escucha
sudo systemctl status auditd               # auditoría activa
sudo aide --check                          # integridad de ficheros
docker compose ps                          # los contenedores siguen sanos
```

## 10. Pruebas de aceptación

| # | Prueba | Resultado esperado |
| :--- | :--- | :---: |
| 1 | Abrir `https://barhub2.duckdns.org` | Certificado SSL válido y la interfaz Angular conectada al backend |
| 2 | `ssh -p 22022 -L 3001:127.0.0.1:3001 barhubadmin@<IP_SERVIDOR>` y abrir `http://127.0.0.1:3001` | Panel de Uptime Kuma operativo; desde fuera, el puerto 3001 no responde |
| 3 | SSH con clave por `22022` | Acceso concedido |
| 4 | SSH con contraseña | Rechazado |
| 5 | SSH como `root` | Rechazado |
| 6 | Puerto no autorizado (p. ej. `3306`) desde fuera | Cerrado / filtrado |
| 7 | `docker compose ps` | Los 7 contenedores en ejecución (6 en local, sin DuckDNS) |
| 8 | Crear un pedido y verlo en comandas | El pedido aparece al momento (aviso en tiempo real) a través de Caddy |

## 11. CI/CD con GitHub Actions

El workflow `.github/workflows/ci-cd.yml` se ejecuta en cada push y pull request a `main` y tiene cuatro jobs.

```mermaid
flowchart LR
    A[Push / PR] --> B["build-and-analyze<br/>build, Vitest, JUnit"]
    B --> C[SonarCloud]
    A --> D["e2e<br/>Docker Compose + Playwright"]
    A --> S["soc<br/>soc.py y configuración"]
    C --> E["docker-build<br/>(solo en main)"]
    D --> E
    S --> E
    E --> F[Docker Hub]
```

| Job | Qué hace |
| :--- | :--- |
| `build-and-analyze` | `npm ci --ignore-scripts` y build de producción del frontend; tests del frontend con cobertura (Vitest); tests del backend con cobertura (JUnit y JaCoCo, Java 21); análisis de SonarCloud con las dos coberturas |
| `e2e` | Genera claves aleatorias en un `.env` temporal, levanta MariaDB, backend, frontend y Caddy con `docker compose` y los datos de demostración, espera a que la API sirva la carta y ejecuta los tests de Playwright ([`e2e/README.md`](../e2e/README.md)). Si fallan, sube el informe con capturas y trazas como artefacto durante 7 días |
| `soc` | Tests de `soc.py` (`unittest`, sin dependencias) y `soc.py validar`: Loki lee su configuración y, en un contenedor aparte, carga y evalúa todas las reglas de alerta; `amtool` revisa la configuración de Alertmanager generada (por defecto y con SMTP y Telegram) y Alloy la suya, todo con las versiones fijadas en el `docker-compose.yml` |
| `docker-build` | Solo en `main`, y solo si los tres anteriores terminan bien: construye la imagen del frontend y la publica en Docker Hub. La del backend se construye en el servidor con `docker compose up --build` |

### 11.1. Análisis estático continuo (SonarCloud)

- **Integración:** el escáner se ejecuta desde el CI; el análisis automático de SonarCloud está desactivado para que no choquen.
- **Código nuevo:** el análisis declara `sonar.projectVersion` (ahora `2.1.0`) y SonarCloud usa «Previous version», de modo que el Quality Gate evalúa el código posterior a esa versión. Los valores globales siguen visibles en Overall Code.
- **Cobertura:** JaCoCo en el backend y lcov de Vitest en el frontend. Los tests (JUnit, `*.spec.ts` y `e2e/`) se declaran como tests y no cuentan como código fuente.
- **Exclusiones justificadas** (`sonar.issue.ignore.multicriteria`, cada una limitada a su regla y sus archivos, con el motivo en un comentario del workflow): `css:S9440` (movimiento reducido) en los CSS de componentes, porque la regla global de `styles.css` ya los cubre; `java:S4790` en `Totp.java` (HMAC-SHA1, que exige la RFC 6238); `java:S2143` en `JwtUtils.java` (JJWT solo acepta `java.util.Date`), y `Web:S6840` en el teléfono del perfil (`tel-national` es un valor válido). Detalle en [auditorias.md](auditorias.md#revisión-del-28-de-noviembre-de-2026-cierre-de-la-21).
- **Quality Gate:** fiabilidad, seguridad y mantenibilidad A, 80 % de cobertura, como mucho un 3 % de duplicación y todos los security hotspots revisados, sobre el código nuevo.

### 11.2. Endurecimiento del workflow

- Acciones fijadas por SHA de commit y permisos mínimos (`contents: read`).
- `npm ci --ignore-scripts`: versiones exactas del `package-lock.json` y sin scripts de instalación. Los tests se lanzan con `npm test` y no con `npx`, que podría descargar un paquete sin versión fijada.
- El job E2E no usa ningún secreto: sus claves son aleatorias y se generan en cada ejecución, y la del administrador se enmascara en los logs.
- El análisis de SonarCloud se omite en los PR de Dependabot, que no reciben los secretos del repositorio.

### 11.3. Contenedores y registro (Docker Hub)

- Imagen del frontend multi-etapa: Node.js 24 compila y Caddy sirve la web con un usuario sin privilegios.
- Autenticación con un **PAT de Docker Hub** guardado como secreto de GitHub.

| Secreto de GitHub | Uso |
| :--- | :--- |
| `SONAR_TOKEN` | Autenticación con SonarCloud |
| `DOCKER_HUB_USERNAME` | Usuario de Docker Hub |
| `DOCKER_HUB_TOKEN` | PAT con permisos de lectura y escritura |

## 12. SOC y monitorización

El servidor combina **monitorización de disponibilidad**, **auditoría del sistema**, **control de integridad**, **filtrado de red** y un **SOC automático** para la aplicación: los logs de Caddy y del backend se recogen, se guardan 30 días y se vigilan con reglas de alerta que avisan por correo (y por Telegram, si se configura). La respuesta sigue siendo manual: el SOC detecta y avisa, no bloquea IP por su cuenta (eso lo hace ya el backend en el login, y Fail2Ban sigue en la [sección 13](#13-mejoras-recomendadas)).

```mermaid
flowchart TB
    subgraph Detección
        UK["Uptime Kuma<br/>disponibilidad"]
        AU["auditd<br/>acciones del sistema"]
        AI["aide<br/>integridad de ficheros"]
        FW["iptables<br/>tráfico filtrado"]
        SOC["SOC de la aplicación<br/>Loki + reglas de alerta"]
    end

    CA["Log de acceso de Caddy"] & BE["Log del backend<br/>auditoría, CSP, errores"] --> AL["Alloy"] --> SOC
    SOC --> AM["Alertmanager"] --> AV["Correo / Telegram"]
    SOC --> GR["Grafana<br/>panel del SOC"]
    UK & AU & AI & FW & AV --> AN["Análisis por el administrador"]
    AN --> RS["Respuesta y recuperación"]
```

### 12.1. SOC de la aplicación (perfil `soc`)

Los logs de Caddy y del backend los vigila el SOC de [`seguridad/soc/`](../seguridad/soc): Alloy los recoge, Loki los guarda y evalúa las reglas de alerta, Alertmanager avisa y Grafana los muestra. Qué detecta, cómo se despliega y se prueba con `soc.py`, qué hacer con cada alerta y qué datos guarda está en [`seguridad/soc/README.md`](../seguridad/soc/README.md). Lo que importa para el servidor:

- Los cuatro contenedores solo arrancan con el perfil `soc` y ningún puerto sale de `127.0.0.1`. Se entra por un túnel SSH: `ssh -p 22022 -L 3000:127.0.0.1:3000 -L 9093:127.0.0.1:9093 usuario@servidor` y, en el navegador, `http://127.0.0.1:3000`.
- Usan del orden de 500 a 700 MB de memoria con este volumen de logs: en un VPS pequeño conviene revisarlo antes de dejarlos siempre encendidos.
- En producción, las alertas tienen que ir a un SMTP real o a Telegram (variables `SOC_*` del `.env`): Mailpit no entrega nada.

### 12.2. Capas de control

| Capa | Herramienta | Qué vigila |
| :--- | :--- | :--- |
| Disponibilidad | **Uptime Kuma** (`127.0.0.1:3001`) | Caídas del sitio, backend y servicios, con histórico y alertas |
| Auditoría | **auditd** | Accesos, cambios de configuración y ejecución de comandos sensibles |
| Integridad | **aide** | Modificación no autorizada de ficheros del sistema |
| Red | **iptables** | Solo `22022`, `80` y `443` aceptan tráfico |
| Acceso | **SSH + PAM** | Solo clave pública, `root` restringido y política de contraseñas |
| Aplicación | **SOC (Alloy, Loki, Alertmanager, Grafana)** | Logs de Caddy y del backend: inicios de sesión fallidos, accesos denegados, 4xx y 5xx, CSP y errores, con alertas |
| Contenedores | **HEALTHCHECK** | Estado de salud de cada contenedor |

### 12.3. Monitores recomendados en Uptime Kuma

| Monitor | Tipo | Objetivo |
| :--- | :--- | :--- |
| Web pública | HTTPS | `https://barhub2.duckdns.org` responde `200` |
| Caducidad TLS | HTTPS | Aviso antes de que expire el certificado |
| API | HTTP | `http://backend:8080/actuator/health` desde la red de Docker (desde fuera no responde) |
| Base de datos | TCP / Docker | Contenedor `barhub-mysql` activo |
| SSH | TCP | Puerto `22022` accesible |
| Notificaciones | Email / Telegram | Aviso inmediato al administrador |

### 12.4. Casos de detección

| Caso | Señal | Fuente | Respuesta |
| :--- | :--- | :--- | :--- |
| Fuerza bruta SSH | Fallos repetidos de autenticación | `auditd`, `/var/log/auth.log` | Bloqueo de IP y revisión |
| Fuerza bruta en login web | `FuerzaBrutaInicioSesion`, `FallosInicioSesionRepartidos` | SOC (auditoría del backend) | Bloqueo automático del backend (cuenta a los 5 fallos, IP a los 20); revisar *Admin → Auditoría* |
| Fichero del sistema alterado | Diferencias en la comprobación | `aide --check` | Aislar, investigar y restaurar |
| Caída de servicio | Monitor en rojo / contenedor *unhealthy* | Uptime Kuma, Docker | Reinicio y análisis de logs |
| Escalada de privilegios | `AccesosDenegadosRepetidos`, `CambioDePrivilegios` | SOC (auditoría del backend) | Revisar la cuenta y cerrar sus sesiones |
| Escaneo de rutas | `EscaneoOAbusoDesdeUnaIp` | SOC (log de Caddy) | Bloquear la IP con `iptables` si sigue |
| XSS o recurso de fuera | `InfraccionCSP` | SOC (avisos de la CSP) | Ver la página y el recurso bloqueado en el panel |
| Fallo de la aplicación | `ErroresDelServidor`, `ErroresDelBackend` | SOC (Caddy y backend) | Ver la traza en el panel y `docker logs barhub-backend` |
| Puerto inesperado abierto | Nuevo servicio en escucha | `ss -tlnp` | Cerrar y auditar |
| Descuadre de caja | `diferencia` distinta de 0 al cierre | Aplicación | Revisión por gerencia |

### 12.5. Respuesta a incidentes

1. **Detección:** alerta del SOC (correo o Telegram), de Uptime Kuma, de `auditd`/`aide` o aviso del personal.
2. **Contención:** aislar el contenedor, bloquear la IP con `iptables` o revocar credenciales.
3. **Análisis:** panel del SOC y consultas en Grafana (Caddy y backend), *Admin → Auditoría* para el usuario, y la línea temporal de `auditd` para el sistema.
4. **Recuperación:** restaurar desde copia de seguridad o desde la imagen anterior de Docker Hub.
5. **Lecciones aprendidas:** documentar el incidente y actualizar [seguridad.md](seguridad.md).

## 13. Mejoras recomendadas

Propuestas **aún no implementadas**, ordenadas por prioridad. Se irán marcando a medida que se apliquen.

| Prioridad | Mejora | Motivo |
| :---: | :--- | :--- |
| Alta | Copias de seguridad de MariaDB (`mysqldump` programado), almacenadas fuera del servidor y con **restauración probada** | La caja y los pedidos son datos de negocio |
| Media | Fail2Ban (SSH y logs de Caddy) | La detección y los avisos ya son automáticos (SOC); falta la respuesta: bloquear la IP en el cortafuegos |
| Media | Límite de peticiones en la creación de pedidos y de intentos de pago (el login ya se bloquea por cuenta y por IP) | Abuso de la API |
| Media | Endurecer los contenedores de la aplicación con `security_opt: [no-new-privileges:true]` y `cap_drop: [ALL]` donde sea posible, como ya llevan los del SOC | Reducir lo que puede hacer un contenedor comprometido |
| Media | Pipeline del backend y `trivy image` sobre las imágenes finales, más `gitleaks` | Cobertura completa de CI y detección de secretos |
| Baja | Quitar DuckDNS cuando el servidor tenga IP fija | Un servicio y una credencial menos |

**Ya aplicadas:** Uptime Kuma, Mailpit y el SOC solo en `127.0.0.1` (por túnel SSH) y Uptime Kuma sin acceso a `docker.sock`; `healthcheck` en MariaDB y el backend espera a que esté sana (`condition: service_healthy`); SOC con alertas por correo y Telegram (perfil `soc`), `JWT_SECRET` y `STRIPE_SECRET_KEY` llegan al backend desde el entorno, las imágenes tienen la versión fijada, DuckDNS solo arranca con el perfil `prod` y Caddy envía las cabeceras de seguridad (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y una CSP estricta).

**Cabeceras de seguridad que Caddy aplica** (el dominio sale de la variable `SITE_ADDRESS`; la CSP completa y su explicación están en `infra/caddy/Caddyfile` y en [seguridad.md](seguridad.md)):

```caddyfile
{$SITE_ADDRESS:http://localhost} {
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy `camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")`
        -Server
    }
    # Content-Security-Policy (o -Report-Only con CSP_CABECERA): default-src 'self';
    # script-src 'self' + Stripe; object-src 'none'; frame-ancestors 'none'; report-uri /api/csp-informe...
    # ... resto de la configuración
}
```