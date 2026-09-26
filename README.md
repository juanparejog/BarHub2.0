# BarHub 2.0 — Carta Digital y Management System

> **BarHub 2.0** es la evolución de la plataforma web de gestión para el sector hostelero (bares, cafeterías y restaurantes). Esta versión actualiza el stack tecnológico, expande las capacidades del sistema (pedidos a domicilio, fidelización por puntos, ofertas y comandas en tiempo real), añade bastionado de seguridad Zero Trust con monitorización continua (SOC) y renueva la experiencia visual y de usuario.

---

## Licencia y Aviso Legal

© **Juan Parejo García** — *Todos los derechos reservados (All Rights Reserved)*.  
Este proyecto es de código propietario. Para más información sobre el uso y términos legales, consulta los archivos [`LICENSE`](./LICENSE) y [`NOTICE.md`](./NOTICE.md).

---

## Novedades y Objetivos de la Versión 2.0

* **Base Legal y Cumplimiento:** Incorporación de licencia propietaria oficial, avisos de copyright y footer legal en la interfaz web.
* **Modernización del Stack:** Actualización a **Java 17 / Spring Boot 3.2+** en el backend y **Angular 17/18** en el frontend, optimizando el rendimiento y solucionando incompatibilidades previas.
* **Ciberseguridad Zero Trust & SOC Automático:** Bastionado del servidor VPS (acceso SSH filtrado por IP, Fail2Ban), imágenes Docker ligeras y sin privilegios root (*distroless/alpine*), pipeline CI/CD seguro con análisis estático y alertas automáticas de eventos vía Telegram/Discord.
* **Experiencia de Usuario (UX):** Menú interactivo con animaciones avanzadas, soporte para escaneo de códigos QR, servicio de pedidos a domicilio y módulo de promociones con sistema de puntos acumulables.
* **Experiencia del Trabajador (EX):** Interfaz táctil optimizada para la gestión de mesas y comandas, incluyendo consulta del **saldo total pendiente por mesa en tiempo real**.

---

## Stack Tecnológico

| Capa | Tecnología / Herramienta |
| :--- | :--- |
| **Backend** | Java 17+, Spring Boot 3.2+, Spring Security, JWT, Resilience4j |
| **Frontend** | Angular 17/18, TypeScript, Tailwind CSS, PrimeNG |
| **Base de Datos** | MariaDB |
| **Infraestructura** | Docker (Multi-stage), Docker Compose, Caddy / Nginx (SSL/TLS) |
| **Seguridad & SOC** | UFW, Fail2Ban, Wazuh Agent, Uptime Kuma, Promtail / Loki |
| **CI/CD & Calidad** | GitHub Actions, SonarQube, Trivy |

---

## Hoja de Ruta por Fases

```text
  [Fase 1] Base Legal, Estructura del Repositorio & Upgrade de Frameworks
     ↓
  [Fase 2] Arquitectura de Backend, Base de Datos & Endpoints REST
     ↓
  [Fase 3] Rediseño Gráfico (UI/UX), Vistas de Usuario y Trabajador
     ↓
  [Fase 4] Bastionado de Contenedores Docker & Spring Security
     ↓
  [Fase 5] Servidor VPS Zero Trust, Pipeline CI/CD & SOC Automático
```

---

## Estructura del Repositorio

```text
barhub/
├── .github/
│   └── workflows/          # Pipelines de CI/CD (ci.yml, cd.yml)
├── backend/                # Proyecto Spring Boot (Java 17)
│   ├── src/
│   ├── Dockerfile
│   └── build.gradle
├── frontend/               # Proyecto Angular 17/18
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── infra/                  # Despliegue e infraestructura
│   ├── docker-compose.yml
│   ├── caddy/
│   └── scripts/            # Scripts de bastionado y backups
├── security/               # Configuración de SOC y auditoría
│   ├── wazuh-agent/
│   ├── fail2ban/
│   └── audit_scripts/
├── docs/                   # Documentación técnica del proyecto
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   └── USER_MANUAL.md
├── LICENSE                 # Licencia Propietaria
├── NOTICE.md               # Aviso Legal
└── README.md               # Presentación general de BarHub 2.0
```

---

## Roles del Sistema

* **Cliente / Usuario:** Acceso a la carta digital interactiva mediante QR, selección del tipo de servicio (Mesa o Domicilio), catálogo de ofertas, canje de puntos, pago digital (Stripe) o en efectivo, y seguimiento del estado del pedido.
* **Empleado / Camarero / Cocinero:** Control del estado de las mesas, recepción y actualización de comandas, confirmación de cobros y cálculo del saldo pendiente acumulado por mesa.
* **Administrador:** Panel de gestión global para la carta, usuarios, promociones, parámetros del sistema y métricas generales del establecimiento.

---

## Instalación y Entorno Local

### Prerrequisitos

* **JDK 17+**
* **Node.js 18+** / **npm 9+**
* **Docker & Docker Compose** (Recomendado para simular la infraestructura completa)

### Pasos de ejecución

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/barhub.git
   cd barhub
   ```

2. **Despliegue con Docker Compose (Recomendado):**
   ```bash
   docker-compose -f infra/docker-compose.yml up --build
   ```

3. **Ejecución manual por componentes:**
   * **Backend:**
     ```bash
     cd backend
     ./gradlew bootRun
     ```
   * **Frontend:**
     ```bash
     cd frontend
     npm install
     ng serve --open
     ```

4. Abrir la aplicación en el navegador web accediendo a `http://localhost:4200` (o a través del proxy en `http://localhost`).

---

## Autor

* **Juan Parejo García** — *Desarrollador Principal*