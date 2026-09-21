# BarHub2.0 — Carta Digital y Management System

> BarHub 2.0 es la evolución de la plataforma web de gestión para hostelería (bares, cafeterías y restaurantes) realizada por mi mismo. Esta versión se centra en elevar la experiencia de usuario, enriquecer la funcionalidad del sistema y reforzar la seguridad en todos los niveles.

## Contexto del Proyecto

BarHub nace para resolver la necesidad de digitalizar y automatizar el ciclo de pedidos, estado de mesas, seguimiento de comandas y pagos en el sector hostelero.

El proyecto original cuenta con arquitectura basada en Spring Boot (Backend), Angular (Frontend), MariaDB (Base de datos) y despliegue modular con Docker en VPS Azure.

## Objetivos de la Version 2

Esta nueva versión refactoriza y mejora el repositorio original centrándose en cuatro pilares principales:

### 1. Rediseño UI/UX y Estilos

* **Interfaz renovada:** Refresco visual general de las vistas de cliente, empleado y administración[cite: 1].
* **Animaciones suaves:** Transiciones, efectos de interacción y feedback visual mejorado al añadir/quitar productos o realizar cambios de estado[cite: 1].
* **Diseño adaptativo:** Optimización completa para dispositivos móviles (smartphones/tablets).

### 2. Nuevas Secciones y Funcionalidades

* **Paneles ampliados:** Nuevos módulos interactivos para la gestión del establecimiento[cite: 1].
* **Experiencia de usuario enriquecida:** Flujos de interacción más directos en la carta interactiva y la gestión de comandas.

### 3. Ciberseguridad Aumentada (Web & Servidor)

* **Hardening en Backend:** Refuerzo de políticas de seguridad en **Spring Security** y control granular de tokens **JWT**.
* **Protección del Servidor:** Mejoras en la configuración de la infraestructura VPS, proxy inverso (**Caddy**) y aislamiento de contenedores Docker.
* **Validación & Sanitización:** Control estricto de entradas para prevenir vulnerabilidades comunes (XSS, SQLi, CSRF).

---

## Stack Tecnológico

| Capa | Tecnología / Herramienta |
| --- | --- |
| **Backend** | Java 17, Spring Boot 3.2, Spring Security, JWT |
| **Frontend** | Angular 14, TypeScript, PrimeNG, PDFMake |
| **Base de Datos** | MariaDB |
| **Pasarela de Pago** | Stripe API |
| **Infraestructura** | Docker, Caddy Reverse Proxy, DuckDNS, Uptime Kuma |
| **Cloud Hosting** | Azure VPS |

---

## Arquitectura del Sistema

```text
               +----------------------------------+
               |        Navegador / Cliente       |
               +----------------------------------+
                                 |
                                 v
               +----------------------------------+
               |        Caddy (Proxy Inverso)     |
               +----------------------------------+
                     /                      \
                    v                        v
    +-----------------------+      +-----------------------+
    |  Frontend (Angular)   |      | Backend (Spring Boot) |
    +-----------------------+      +-----------------------+
                                               |
                                               v
                                   +-----------------------+
                                   |   MariaDB Database    |
                                   +-----------------------+

```

---

## Roles del Sistema

* **Cliente / Usuario:** Acceso a la carta digital, selección de mesa, carrito interactivo, pago mediante tarjeta/efectivo, generación de ticket PDF y seguimiento en tiempo real de la comanda.
* **Empleado / Camarero / Cocinero:** Gestión del estado de las mesas (Disponible/Reservada), confirmación de pagos en efectivo y actualización de comandas (Pendiente / Preparado / Servido).
* **Administrador:** Gestión integral de productos, usuarios, roles y métricas del sistema.

---

## Instalación y Entorno Local

### Prerrequisitos

* **JDK 17+**
* **Node.js 18+** y **npm 9+**
* **Docker 24+** (Opcional, para ejecución con contenedores)

### Pasos de ejecución

1. **Clonar el repositorio:**
```bash
git clone https://github.com/tu-usuario/barhub-v2.git
cd barhub-v2

```


2. **Ejecutar Backend (Spring Boot):**
```bash
cd BarHub-BackendSpring
./gradlew bootRun

```


3. **Ejecutar Frontend (Angular):**
```bash
cd BarHub-FrontendAngular
npm install
ng serve --open

```


4. Accede a `http://localhost:4200` en tu navegador.

---

## Autor

* **Juan Parejo García** — *Desarrollador Principal*