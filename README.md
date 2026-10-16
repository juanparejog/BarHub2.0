<h1 align="center">BarHub 2.0 — Management System & Carta Digital</h1>

<p align="center">
  <img src="docs/img/logo.png" alt="BarHub 2.0 Logo" width="420">
</p>

<p align="center">
  <b>Plataforma integral de gestión hostelera, comandas en tiempo real y arquitectura bastionada Zero Trust.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Java-17-orange?style=for-the-badge&logo=java" alt="Java 17">
  <img src="https://img.shields.io/badge/Spring_Boot-3.2+-brightgreen?style=for-the-badge&logo=springboot" alt="Spring Boot 3.2">
  <img src="https://img.shields.io/badge/Angular-17%2F18-dd0031?style=for-the-badge&logo=angular" alt="Angular">
  <img src="https://img.shields.io/badge/Docker-Multi--stage-blue?style=for-the-badge&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/Security-Zero_Trust-red?style=for-the-badge" alt="Zero Trust">
</p>

---

## Descripción del Proyecto

**BarHub 2.0** es una solución tecnológica avanzada diseñada para optimizar la operativa diaria en establecimientos hosteleros (bares, cafeterías y restaurantes). La plataforma combina una experiencia de cliente fluida mediante carta digital interactiva con un completo panel de administración y control operativo para el personal de sala, cocina y gerencia.

Esta versión representa una modernización integral del sistema: actualiza la arquitectura base a versiones LTS recientes de **Spring Boot** y **Angular**, refuerza la ciberseguridad mediante un modelo **Zero Trust con monitorización SOC continua** e incorpora módulos clave para el control financiero y analítico del local.

---

## Licencia y Aviso Legal

© **Juan Parejo García** — *Todos los derechos reservados (All Rights Reserved)*.  
Este software es de código propietario. Para conocer los términos de uso y condiciones legales, consulta los archivos oficiales del repositorio:
* [`LICENSE`](./LICENSE) — Términos de Licencia Propietaria.
* [`NOTICE`](./NOTICE) — Aviso Legal y Reserva de Derechos.

---

## Novedades y Capacidades Principales

### Experiencia de Cliente (UX)
* **Carta Digital Interactiva (QR):** Acceso inmediato mediante escaneo de códigos QR sin necesidad de instalar aplicaciones.
* **Modalidades de Pedido:** Elección entre consumo en **Mesa** o servicio a **Recoger** o a **Domicilio**.
* **Seguimiento de Pedido a Tiempo Real:** Monitoreo y actualización del estado del pedido en tiempo real durante su preparación y entrega.
* **Pasarela de Pago Integrada:** Soporte para pagos digitales seguros (Stripe) y pago directo en efectivo.
* **Perfil de Usuario:** Consulta y gestión de datos personales, historial de pedidos realizados y saldo de puntos de fidelización.

### Experiencia del Personal y Sala (EX)
* **Comandas y Mesas en Tiempo Real:** Interfaz optimizada para la recepción de pedidos y estado de mesas.
* **Comprobación de Pagos en Efectivo en Tiempo Real:** Validación y confirmación inmediata de los cobros realizados en efectivo tanto en barra/caja como en mesa por parte del personal.
* **Apertura y Cierre de Caja:** Módulo para el control de flujo de efectivo al inicio de la jornada, registro de movimientos y arqueo diario al cierre.

### Gestión Financiera y Analítica (Administración)
* **Panel de Estadísticas Avanzadas:** Análisis visual de ingresos, productos más vendidos, horas pico de afluencia y métricas globales.
* **Gestión Dinámica de Menú:** Actualización en tiempo real del catálogo de productos, precios y disponibilidad.

### Ciberseguridad Zero Trust & SOC
* **Bastionado VPS & Red:** Filtrado de accesos SSH por IP, cortafuegos UFW y prevención de intrusiones con Fail2Ban.
* **Contenedores Ligeros y Seguros:** Despliegue en Docker con imágenes de bajo tamaño y sin privilegios superusuario (*rootless/distroless/alpine*).
* **Auditoría Continuada:** Monitorización de eventos de seguridad con alertas automáticas en tiempo real (Telegram/Discord).

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
  [X] Fase 1: Base Legal, Estructura del Repositorio & Upgrade de Frameworks (Completada)
     ↓
  [X] Fase 2: Arquitectura de Backend, Base de Datos & Endpoints REST (Completada)
     ↓
  [X] Fase 3: Rediseño Gráfico (UI/UX), Vistas de Usuario y Trabajador (Completada)
     ↓
  [ ] Fase 4: Bastionado de Contenedores Docker & Spring Security
     ↓
  [ ] Fase 5: Servidor VPS Zero Trust, Pipeline CI/CD & SOC Automático (Infraestructura Completada)