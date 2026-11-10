# Documentación Técnica de Despliegue, Conexión SSH Segura y Bastionado - BarHub 2.0

La presente documentación establece el procedimiento operativo estandarizado para el despliegue de la arquitectura multi-contenedor de **BarHub 2.0** (Spring Boot, Angular, MariaDB, Uptime Kuma, DuckDNS y Caddy), la configuración de accesos remotos seguros mediante criptografía asimétrica y la posterior aplicación de directivas de endurecimiento (*hardening*) sobre el servidor.

---

## 1.- Conexión SSH Segura y Bastionada

### 1.1.- Configuración de Red y Reenvío de Puertos
Para entornos virtuales aislados bajo el modo NAT, se establece un puente perimetral desde el host anfitrión para garantizar el acceso remoto al servicio de administración:
* Se configura el **Reenvío de Puertos (Port Forwarding)** en el hipervisor.
* El tráfico dirigido al puerto seguro personalizado **`22022`** de la interfaz local se redirige de forma transparente al puerto `22022` del servidor invitado.

### 1.2.- Generación del Par de Claves Criptográficas
En el equipo cliente o anfitrión, se genera el par de claves mediante criptografía asimétrica estándar:
```cmd
ssh-keygen -t rsa -b 4096
```
Este proceso genera dos ficheros en el perfil local (`~/.ssh/`):
* `id_rsa`: Clave privada (mantenida de forma estrictamente confidencial).
* `id_rsa.pub`: Clave pública (destinada a la validación en el servidor).

### 1.3.- Autorización y Respeto al Bastionado de OpenSSH
Como parte de las políticas de seguridad, el servidor desactiva la autenticación tradicional por contraseña (`PasswordAuthentication no`), exigiendo obligatoriamente identificación por clave pública.

Para registrar la identidad de confianza:
1. Se transfiere el contenido de la clave pública (`id_rsa.pub`).
2. Se registra e inserta la clave dentro del directorio de autorizaciones del servidor remoto:
   ```bash
   mkdir -p ~/.ssh
   nano ~/.ssh/authorized_keys
   ```
3. Se configuran los permisos estrictos requeridos por los estándares de seguridad:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

### 4. Ejecución de la Conexión Remota Segura
Validada la identidad criptográfica y operativo el demonio de red, la conexión remota hacia el servidor bastionado se ejecuta mediante el comando:
```cmd
ssh -i C:\Users\User\.ssh\id_rsa -p 22022 usuario@<IP_SERVIDOR>
```

---

## 2.- Requisitos Previos del Entorno de Producción

* Se requiere un servidor aprovisionado con un sistema operativo Linux compatible (recomendado: Debian 12 o Ubuntu LTS).
* Se debe disponer de acceso administrativo mediante el canal SSH seguro configurado en el Módulo I.
* Es necesario contar con un nombre de dominio plenamente operativo (ej. `barhub2.duckdns.org`) cuyos registros DNS (tipo A/AAAA) apunten de forma directa a la dirección IP pública del servidor.
* Se requiere disponer anticipadamente de los parámetros confidenciales de configuración y credenciales operativas.

---

## 3.- Preparación e Infraestructura del Servidor

1. **Actualización del sistema operativo:**
   Se procede a la actualización de los repositorios de paquetes y del software base:
   ```bash
   apt update && apt upgrade -y
   ```

2. **Creación de usuario con privilegios administrativos:**
   Por motivos de seguridad operativa, se recomienda el uso de un usuario dedicado:
   ```bash
   adduser barhubadmin
   usermod -aG sudo barhubadmin
   ```

---

## 4.- Gestión del Repositorio y Variables de Entorno

1. **Clonación del código fuente:**
   Se descarga el repositorio oficial del proyecto en el directorio de trabajo del servidor:
   ```bash
   git clone https://github.com/tu-usuario/BarHub2.0.git
   cd BarHub2.0
   ```

2. **Configuración de credenciales de producción:**
   Se genera el fichero de variables de entorno (`.env`) dentro de la ruta `infra/docker/` incorporando los parámetros requeridos:
   ```env
   MYSQL_ROOT_PASSWORD=contrasena_root_muy_segura
   DB_DATABASE=barhub_db
   DB_USERNAME=barhub_user
   DB_PASSWORD=contrasena_usuario_segura
   DUCKDNS_DOMAINS=barhub2
   DUCKDNS_TOKEN=tu-token-de-duckdns-aqui
   ```

3. **Validación de la estructura de ficheros:**
   Se corrobora la correcta disposición de los componentes:
   * Orquestación Docker: `infra/docker/docker-compose.yml`
   * Enrutamiento y Proxy: `infra/caddy/Caddyfile`
   * Inicialización de Base de Datos: `infra/docker/import.sql` (opcional)

---

## 5.- Orquestación y Despliegue de Contenedores

1. **Despliegue de la infraestructura:**
   Se compilan y ejecutan los servicios en segundo plano utilizando el orquestador:
   ```bash
   cd infra/docker
   docker compose up -d --build
   ```

2. **Auditoría del estado de los contenedores:**
   Se comprueba la correcta ejecución y persistencia de todos los servicios (`barhub-mysql`, `barhub-backend`, `barhub-frontend`, `barhub-caddy`, `barhub-duckdns` y `barhub-uptime-kuma`):
   ```bash
   docker compose ps
   ```

3. **Verificación de certificados SSL/TLS:**
   Se inspeccionan los registros (*logs*) del proxy inverso para confirmar la emisión automatizada de los certificados de seguridad:
   ```bash
   docker logs -f barhub-caddy
   ```

---

## 6.- Endurecimiento del Sistema (Hardening)

Como fase final e imperativa de seguridad para mitigar vectores de ataque, se ejecuta el script automatizado de bastionado sobre el sistema operativo, diseñado para preservar la integridad de las interfaces de red virtuales utilizadas por Docker.

1. **Ejecución del script de bastionado:**
   Tras transferir el archivo `hardening-linux.py` al servidor, se ejecuta con privilegios de superusuario:
   ```bash
   sudo python3 hardening-linux.py
   ```

2. **Directivas principales aplicadas por el script:**
   * **Política de contraseñas y PAM:** Establecimiento de complejidad estricta y políticas de caducidad.
   * **Optimización y seguridad del Kernel (`sysctl`):** Mitigación frente a vulnerabilidades de red comunes, manteniendo activos los parámetros requeridos para el enrutamiento de contenedores.
   * **Monitoreo y Auditoría:** Configuración avanzada de `auditd` con reglas de supervisión estricta y control de integridad de ficheros mediante `aide`.
   * **Bastionado del servicio SSH:** Consolidación del puerto `22022`, restricción de accesos directos al usuario `root` y limitación de sesiones concurrentes.
   * **Filtrado de paquetes (Netfilter/iptables):** Consolidación de reglas restrictivas en la capa de entrada que salvaguardan los puertos de servicio (`22022`, `80`, `443`, `3001`), preservando de manera intacta las cadenas operativas de NAT de Docker.

---

## 7.- Pruebas de Aceptación y Validación Final

1. **Comprobación de conectividad web segura:**
   Se accede desde un navegador externo al dominio configurado:
   ```text
   https://barhub2.duckdns.org
   ```
   *Se verifica la correcta resolución del certificado SSL válido y la visualización de la interfaz de usuario de Angular conectada al backend.*

2. **Verificación de la plataforma de monitorización:**
   Se valida el estado operativo de los componentes de infraestructura mediante el panel de control centralizado:
   ```text
   http://<IP_PUBLICA_DEL_VPS>:3001
   ```