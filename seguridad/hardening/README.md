# Linux System Hardening

## 1. Descripción del script

`hardening-linux.py` es un script de automatización desarrollado en Python 3 para aplicar medidas de endurecimiento de seguridad (*system hardening*) sobre sistemas Linux basados en Debian.

Su objetivo es reducir la superficie de ataque del sistema mediante la configuración de políticas de seguridad, el refuerzo de los mecanismos de autenticación, la restricción de servicios y protocolos, la implantación de controles de auditoría y la configuración de un cortafuegos local.

El script agrupa las tareas de seguridad en once fases consecutivas, que abarcan desde la preparación del entorno y la instalación de herramientas hasta el establecimiento de reglas de filtrado de tráfico de red.

Está orientado a entornos de laboratorio, servidores Linux y prácticas de administración segura de sistemas, especialmente en escenarios relacionados con la ciberseguridad y la puesta en producción segura.

> **Advertencia:** el script modifica archivos de configuración del sistema, instala y elimina paquetes, altera parámetros del kernel, reinicia servicios y establece políticas de firewall. Debe probarse previamente en un entorno controlado y no ejecutarse directamente en sistemas de producción sin una revisión técnica y un plan de recuperación.

## 2. Objetivos de seguridad

Los principales objetivos del script son:

- Reducir la superficie de ataque del sistema operativo.
- Reforzar las políticas de contraseñas y la configuración de autenticación.
- Restringir los permisos de acceso a determinados recursos y herramientas administrativas.
- Aplicar parámetros de seguridad al kernel y a la pila de red.
- Eliminar paquetes asociados a servicios y protocolos considerados innecesarios.
- Incorporar herramientas de auditoría, supervisión y detección de posibles compromisos.
- Establecer mecanismos de verificación de integridad del sistema de archivos.
- Endurecer la configuración del servicio SSH.
- Configurar medidas de control de acceso y protección frente a intentos de autenticación repetidos.
- Restringir el tráfico entrante mediante reglas de filtrado de paquetes.

## 3. Tecnologías y herramientas

| Tecnología o herramienta | Función dentro del script |
|---|---|
| Python 3 | Lenguaje utilizado para automatizar las tareas de configuración. |
| APT | Gestión de paquetes y actualización de los repositorios. |
| Docker | Instalación y habilitación del entorno de contenedores. |
| Lynis | Herramienta de auditoría de seguridad para sistemas Linux. |
| PAM | Gestión de módulos de autenticación y políticas de contraseñas. |
| OpenSSH | Acceso remoto seguro y configuración del servicio SSH. |
| sysctl | Configuración de parámetros del kernel y de red. |
| auditd | Registro de determinados eventos relevantes para la auditoría del sistema. |
| sysstat | Recopilación de estadísticas de rendimiento y actividad. |
| Fail2ban | Protección frente a determinados intentos repetidos de autenticación. |
| AIDE | Comprobación de la integridad de archivos y directorios. |
| rkhunter | Herramienta de búsqueda de posibles indicadores de rootkits. |
| chkrootkit | Herramienta de comprobación de posibles rootkits. |
| iptables | Configuración de reglas de filtrado de tráfico de red. |
| Netfilter Persistent | Persistencia de las reglas del firewall. |
| AppArmor | Instalación de herramientas y perfiles relacionados con el control de acceso obligatorio. |
| TCP Wrappers | Configuración de los archivos tradicionales de control de acceso por hosts. |

La instalación de estas herramientas no implica que todas queden completamente configuradas, habilitadas o verificadas. Su comportamiento depende de las acciones específicas que realiza cada fase.

## 4. Arquitectura y funcionamiento

El programa se ejecuta secuencialmente a través de la función `main()`, que invoca las distintas funciones de endurecimiento después de comprobar que el proceso dispone de privilegios administrativos.

### Fase 0. Preparación e instalación de Docker

**Función:** `paso_0_preparacion()`

Prepara el entorno de paquetes e instala las herramientas iniciales.

Operaciones principales:

- Elimina el archivo de configuración anterior del repositorio de Docker, si existe.
- Crea el directorio `/etc/apt/keyrings`.
- Descarga la clave de firma del repositorio oficial de Docker.
- Configura el repositorio de Docker para Debian Bookworm y arquitectura AMD64.
- Actualiza los índices de paquetes.
- Instala Lynis, cURL, Docker Engine, Docker CLI, containerd y el complemento Docker Compose.
- Inicia y habilita el servicio Docker si detecta el archivo de unidad de servicio esperado.

**Finalidad de seguridad:** preparar las herramientas necesarias para la administración y auditoría del entorno.

**Consideraciones:** la configuración del repositorio está fijada a Debian Bookworm y AMD64. Debe revisarse antes de ejecutar el script en otra distribución, versión o arquitectura.

### Fase 1. Gestión de usuarios y políticas de contraseñas

**Función:** `paso_1_usuarios_y_permisos()`

Aplica medidas relacionadas con la autenticación, la caducidad de contraseñas y los permisos de determinados recursos administrativos.

Operaciones principales:

- Instala los paquetes `libpam-tmpdir` y `libpam-pwquality`.
- Añade directivas a `/etc/login.defs` cuando no detecta previamente sus nombres.
- Establece los siguientes valores en las directivas que añade:

| Directiva | Valor | Finalidad |
|---|---:|---|
| `PASS_MIN_DAYS` | 7 | Establece un intervalo mínimo entre cambios de contraseña. |
| `PASS_MAX_DAYS` | 90 | Establece un período máximo de validez de la contraseña. |
| `PASS_WARN_DAYS` | 7 | Define el período de aviso previo a la caducidad. |
| `UMASK` | 027 | Restringe los permisos predeterminados de los archivos creados mediante los mecanismos que utilizan esta configuración. |
| `SHA_CRYPT_MIN_ROUNDS` | 5000 | Establece el número mínimo de rondas configurado para SHA crypt. |
| `SHA_CRYPT_MAX_ROUNDS` | 10000 | Establece el número máximo de rondas configurado para SHA crypt. |

También sobrescribe `/etc/security/pwquality.conf` con una política de complejidad de contraseñas:

| Parámetro | Valor | Finalidad |
|---|---:|---|
| `minlen` | 12 | Longitud mínima configurada. |
| `dcredit` | -1 | Exige al menos un dígito. |
| `ucredit` | -1 | Exige al menos una letra mayúscula. |
| `lcredit` | -1 | Exige al menos una letra minúscula. |
| `ocredit` | -1 | Exige al menos un carácter no alfanumérico. |
| `minclass` | 3 | Exige representación de al menos tres clases de caracteres. |

Por último, añade una regla de historial de contraseñas en `/etc/pam.d/common-password`, con el objetivo de recordar las últimas trece contraseñas, y restringe los permisos de determinados archivos y directorios de tareas programadas.

**Finalidad de seguridad:** mejorar las políticas de autenticación, dificultar la reutilización de contraseñas y reducir la exposición de archivos administrativos.

**Consideraciones:** la incorporación de una regla PAM al final del archivo no garantiza que se aplique correctamente. Es necesario comprobar el orden de los módulos y su interacción con la configuración existente. Asimismo, las directivas de `/etc/login.defs` no se actualizan si el script detecta que sus nombres ya aparecen en el archivo.

### Fase 2. Configuración de banners legales

**Función:** `paso_2_banners()`

Configura mensajes de advertencia en los siguientes archivos:

- `/etc/issue`
- `/etc/issue.net`

El mensaje informa de que el sistema está destinado a usos autorizados y de que la actividad puede ser supervisada y notificada.

**Finalidad de seguridad:** comunicar las condiciones de uso y advertir de la posible supervisión de la actividad del sistema.

**Consideraciones:** el banner de `/etc/issue.net` solo se mostrará durante el acceso remoto si el servicio correspondiente está configurado para utilizarlo.

### Fase 3. Endurecimiento del kernel y de la pila de red

**Función:** `paso_3_kernel()`

Añade parámetros de seguridad a `/etc/sysctl.conf` y aplica la configuración mediante `sysctl -p`.

Las directivas se agrupan en varias categorías.

**Protección del kernel y de la memoria**

- Deshabilita la carga automática de determinados controladores de línea de terminal.
- Restringe el acceso a información de depuración del kernel.
- Restringe la exposición de direcciones de punteros del kernel.
- Deshabilita SysRq.
- Deshabilita BPF sin privilegios.
- Establece restricciones sobre `ptrace`.
- Endurece la compilación JIT de BPF.
- Protege los enlaces simbólicos y duros.
- Activa la aleatorización del espacio de direcciones mediante ASLR.
- Configura la deshabilitación de la carga de módulos del kernel.

**Protección de la pila de red**

- Activa el registro de determinadas direcciones de origen sospechosas.
- Habilita el filtrado de rutas de retorno.
- Deshabilita el envío de redirecciones ICMP desde el sistema.
- Deshabilita la aceptación de determinadas redirecciones IPv4 e IPv6.
- Activa las cookies TCP SYN.
- Ajusta los reintentos de SYN-ACK.
- Activa una protección relacionada con conexiones TCP en determinadas situaciones.
- Ignora determinados mensajes ICMP de difusión y respuestas de error no válidas.

**Finalidad de seguridad:** reducir la exposición de información interna, endurecer mecanismos de protección de memoria y limitar determinados comportamientos de red susceptibles de ser aprovechados en ataques.

**Consideraciones:** el script añade los parámetros al archivo sin comprobar si ya existen. Las directivas duplicadas pueden generar resultados difíciles de mantener. Además, `kernel.modules_disabled = 1` impide cargar o descargar módulos del kernel posteriormente y no puede volver a establecerse a `0` durante el mismo arranque. Esta medida puede afectar a Docker, a controladores y a otros servicios que dependan de módulos cargables.

### Fase 4. Eliminación de servicios y paquetes innecesarios

**Función:** `paso_4_eliminar_servicios()`

Desinstala los siguientes paquetes:

- `rsh-client`
- `atftpd`
- `tftp`

Después ejecuta `apt autoremove` para eliminar dependencias que APT considere innecesarias.

**Finalidad de seguridad:** reducir la superficie de ataque eliminando componentes relacionados con servicios o protocolos que no se consideran necesarios para el entorno previsto.

**Consideraciones:** debe comprobarse previamente que estos paquetes no sean necesarios para tareas legítimas del sistema. La eliminación de un paquete no garantiza que hayan desaparecido todos los servicios equivalentes ni que no existan otros componentes que proporcionen la misma funcionalidad.

### Fase 5. Auditoría, supervisión y registro de eventos

**Función:** `paso_5_auditoria()`

Instala herramientas orientadas a la supervisión del sistema, la auditoría y la detección de posibles problemas de seguridad.

Entre los paquetes instalados se encuentran:

- `apt-listbugs`
- `apt-listchanges`
- `debsums`
- `apt-show-versions`
- `fail2ban`
- `aide`
- `acct`
- `auditd`
- `sysstat`
- `rkhunter`
- `chkrootkit`
- `needrestart`

Posteriormente:

- Modifica la configuración de `sysstat` para habilitar su funcionamiento mediante una sustitución de texto.
- Habilita e inicia los servicios `auditd` y `sysstat`.
- Descarga un conjunto de reglas de auditoría desde el repositorio de Neo23x0.
- Guarda las reglas descargadas en `/etc/audit/rules.d/audit.rules`.
- Reinicia `auditd`.

**Finalidad de seguridad:** disponer de mecanismos de registro y herramientas de apoyo para investigar actividad sospechosa, revisar la integridad de paquetes y detectar posibles indicadores de compromiso.

**Consideraciones:** la descarga de reglas externas introduce una dependencia de un tercero. Las reglas deben revisarse antes de su aplicación, verificando su compatibilidad con la versión de `auditd` y con los requisitos del sistema. La instalación de herramientas como Fail2ban, AIDE o rkhunter no garantiza por sí sola que sus políticas estén correctamente configuradas ni que se ejecuten comprobaciones periódicas.

### Fase 6. Restricción de compiladores y módulos de red

**Función:** `paso_6_compiladores_y_modulos()`

Aplica restricciones a determinadas herramientas de compilación y a varios protocolos de red.

**Restricción de compiladores**

Intenta establecer permisos `700` en los siguientes ejecutables:

- `/usr/bin/gcc`
- `/usr/bin/g++`
- `/usr/bin/make`

Esta configuración permite el acceso al propietario, normalmente `root`, y restringe el acceso de los demás usuarios.

**Deshabilitación de protocolos**

Crea el archivo `/etc/modprobe.d/blacklist-uncommon.conf` con directivas que impiden la carga de los módulos asociados a:

- DCCP
- SCTP
- RDS
- TIPC

**Finalidad de seguridad:** restringir la disponibilidad de herramientas de compilación y reducir la exposición a protocolos de red que no sean necesarios.

**Consideraciones:** restringir los compiladores puede interferir con instalaciones de software, módulos externos y tareas de mantenimiento. Las directivas de `modprobe` deben verificarse y no sustituyen una comprobación del estado real de los módulos cargados.

### Fase 7. Verificación de integridad con AIDE

**Función:** `paso_7_cifrado()`

A pesar del nombre de la función, esta fase no implementa cifrado de datos. Su objetivo es inicializar la base de datos de integridad de AIDE.

Operaciones principales:

1. Comprueba si existe el directorio `/etc/aide/aide.conf.d`.
2. Si existe, sustituye determinadas apariciones de `KALI-ROLLING` por `kali` en sus archivos.
3. Ejecuta `aide --init` utilizando `/etc/aide/aide.conf`.
4. Si existe `/var/lib/aide/aide.db.new`, la mueve a `/var/lib/aide/aide.db`.

**Finalidad de seguridad:** establecer una base de referencia para comprobar posteriormente si determinados archivos del sistema han sufrido modificaciones.

**Consideraciones:** la base de datos inicial debe generarse en un estado conocido y confiable. Su protección es esencial para evitar que un atacante modifique tanto los archivos supervisados como la referencia utilizada para compararlos.

La inicialización de AIDE no equivale a ejecutar una auditoría completa de integridad. El script tampoco programa comprobaciones periódicas.

### Fase 8. Endurecimiento de OpenSSH

**Función:** `paso_8_ssh_hardening()`

Modifica la configuración del servicio SSH para restringir el acceso remoto.

Antes de realizar cambios, crea una copia de `/etc/ssh/sshd_config` en `/etc/ssh/sshd_config.bak`, siempre que el archivo original exista y no haya una copia previa.

También ajusta los permisos de `/root/.ssh` y de su archivo `authorized_keys`, si existen.

Las directivas que añade son:

| Directiva | Valor | Objetivo |
|---|---|---|
| `Protocol` | `2` | Especifica el protocolo SSH 2. |
| `Port` | `22022` | Configura un puerto SSH alternativo. |
| `PermitRootLogin` | `prohibit-password` | Permite el acceso de root mediante mecanismos distintos de la contraseña, sujeto al resto de la configuración. |
| `PubkeyAuthentication` | `yes` | Habilita la autenticación mediante clave pública. |
| `PasswordAuthentication` | `no` | Deshabilita la autenticación SSH mediante contraseña. |
| `PermitEmptyPasswords` | `no` | Prohíbe las contraseñas vacías. |
| `MaxAuthTries` | `3` | Limita los intentos de autenticación por conexión. |
| `MaxSessions` | `2` | Limita las sesiones multiplexadas por conexión de red. |
| `ClientAliveInterval` | `300` | Establece el intervalo de comprobación de actividad del cliente. |
| `ClientAliveCountMax` | `2` | Limita las comprobaciones sin respuesta antes de cerrar la conexión. |
| `X11Forwarding` | `no` | Deshabilita el reenvío X11. |
| `AllowTcpForwarding` | `no` | Deshabilita el reenvío TCP mediante SSH. |
| `LogLevel` | `VERBOSE` | Aumenta el nivel de detalle de los registros de SSH. |
| `Banner` | `/etc/issue.net` | Establece el banner legal para las conexiones que lo utilicen. |

Finalmente, ejecuta `sshd -t` para comprobar la sintaxis de la configuración y reinicia el servicio SSH.

**Finalidad de seguridad:** reducir las posibilidades de autenticación remota mediante contraseñas, limitar ciertas funcionalidades de SSH y aumentar el detalle de los registros.

**Consideraciones críticas:**

- Debe existir una clave pública autorizada y debe probarse el acceso antes de cerrar la sesión administrativa actual.
- El cambio del puerto SSH requiere actualizar las reglas del fireawll y las herramientas de conexión.
- El script añade directivas al final de `sshd_config` sin eliminar ni modificar las existentes. Las directivas duplicadas pueden provocar que los valores efectivos no sean los esperados.
- La comprobación `sshd -t` valida la sintaxis, pero no garantiza que la configuración efectiva cumpla las políticas previstas ni que el acceso remoto funcione.
- La restricción de `AllowTcpForwarding` puede afectar a túneles SSH y a determinados flujos de administración.

### Fase 9. Control de acceso y Fail2ban

**Función:** `paso_9_red()`

Modifica los archivos tradicionales de control de acceso por hosts:

- `/etc/hosts.deny`: establece una regla general de denegación.
- `/etc/hosts.allow`: añade una regla que permite SSH desde cualquier origen para los servicios compatibles con TCP Wrappers.

Si detecta `/etc/fail2ban/jail.conf`, lo copia a `/etc/fail2ban/jail.local` y reinicia Fail2ban.

**Finalidad de seguridad:** introducir una política tradicional de control de acceso y activar las reglas de Fail2ban disponibles en la configuración resultante.

**Consideraciones:** TCP Wrappers no constituye un mecanismo de control de acceso efectivo para todos los servicios modernos. OpenSSH no utiliza necesariamente estos archivos. Además, copiar la configuración predeterminada de Fail2ban no garantiza que exista una cárcel SSH correctamente configurada ni que coincida con el puerto alternativo definido en la fase anterior.

### Fase 10. Configuración del firewall local

**Función:** `paso_10_firewall()`

Instala los paquetes necesarios para gestionar y persistir las reglas de filtrado, además de las herramientas relacionadas con AppArmor.

A continuación, vacía las reglas existentes de la cadena `INPUT` y establece una nueva política de filtrado.

Las reglas añadidas permiten:

| Tráfico | Acción | Finalidad |
|---|---|---|
| Interfaz de loopback | Aceptar | Permitir la comunicación local mediante `lo`. |
| Conexiones `ESTABLISHED,RELATED` | Aceptar | Permitir tráfico perteneciente a conexiones existentes o relacionadas. |
| TCP/22022 | Aceptar | Permitir conexiones SSH al puerto configurado. |
| TCP/80 | Aceptar | Permitir tráfico HTTP. |
| TCP/443 | Aceptar | Permitir tráfico HTTPS. |
| Resto del tráfico entrante | Denegar | Aplicar la política predeterminada `DROP` a `INPUT`. |

También establece las siguientes políticas predeterminadas:

- `INPUT`: `DROP`.
- `FORWARD`: `ACCEPT`.
- `OUTPUT`: `ACCEPT`.

Finalmente, ejecuta `netfilter-persistent save` para guardar las reglas.

**Finalidad de seguridad:** limitar el tráfico entrante a los puertos expresamente permitidos y mantener la conectividad saliente.

**Consideraciones críticas:**

- La limpieza de reglas mediante `iptables -F` puede eliminar reglas preexistentes necesarias para la conectividad o la seguridad.
- La cadena `FORWARD` permanece con política `ACCEPT`, por lo que no se establece una política restrictiva de reenvío.
- Las reglas de IPv4 no sustituyen la configuración de un firewall IPv6.
- Docker puede modificar las reglas de Netfilter para gestionar la conectividad de sus contenedores. Es necesario comprobar que la política resultante protege también los servicios publicados por Docker.
- No se configura un mecanismo de reversión automática si se pierde el acceso remoto.
- La instalación de AppArmor y sus herramientas no equivale a activar ni a aplicar perfiles de seguridad a todos los servicios.

## 5. Requisitos previos

Antes de ejecutar el script, se recomienda disponer de:

- Un sistema Linux basado en Debian compatible con los paquetes y rutas utilizados.
- Python 3 instalado.
- Privilegios administrativos mediante `root` o `sudo`.
- Conectividad a Internet para descargar paquetes, claves y reglas externas.
- Acceso a los repositorios APT configurados.
- Una copia de seguridad de los archivos de configuración relevantes.
- Acceso a la consola local o a una consola de recuperación.
- Una sesión administrativa alternativa si el sistema se administra remotamente.

El script presupone la existencia de rutas y servicios propios de sistemas Debian, por lo que no debe considerarse compatible de forma universal con todas las distribuciones Linux.

## 6. Instalación y ejecución

### 6.1. Obtener el script

Guarda el archivo como:

`hardening-linux.py`

### 6.2. Revisar el código

Antes de ejecutarlo, revisa especialmente:

- Las modificaciones realizadas en `/etc/ssh/sshd_config`.
- Los parámetros añadidos a `/etc/sysctl.conf`.
- Las reglas de filtrado de `iptables`.
- Los paquetes que se instalan y desinstalan.
- Las descargas de archivos de configuración externos.
- Las rutas que se sobrescriben directamente.

### 6.3. Ejecutar el script

Desde el directorio donde se encuentra el archivo:

```bash
sudo python3 hardening-linux.py
```

El programa comprueba si se está ejecutando como administrador. Si no dispone de privilegios de `root`, termina la ejecución.

### 6.4. Supervisar el proceso

El script muestra mensajes en la terminal para identificar las distintas fases y los comandos ejecutados.

Los errores detectados durante la ejecución de los comandos se muestran mediante mensajes de error. Sin embargo, la función `run_cmd()` devuelve `None` cuando captura una excepción `CalledProcessError`, y las funciones de endurecimiento no comprueban sistemáticamente ese resultado. Por tanto, una operación fallida no detiene necesariamente el proceso completo.

Se recomienda revisar manualmente el resultado de cada fase y no interpretar el mensaje final de finalización como una prueba de que todas las medidas se han aplicado correctamente.

## 7. Verificación posterior

Después de ejecutar el script, es necesario comprobar que las medidas previstas se encuentran realmente activas.

### 7.1. Comprobar el servicio SSH

```bash
sudo sshd -t
sudo sshd -T
sudo systemctl status ssh
```

Revisar la configuración efectiva de los parámetros de autenticación, el puerto, las sesiones y el reenvío.

Para comprobar el puerto en escucha:

```bash
sudo ss -tlnp
```

### 7.2. Comprobar el firewall

```bash
sudo iptables -L -n -v
sudo iptables -S
sudo ip6tables -L -n -v
```

Verificar las políticas predeterminadas, las reglas activas y la exposición de los servicios.

### 7.3. Comprobar los parámetros del kernel

```bash
sysctl kernel.randomize_va_space
sysctl kernel.dmesg_restrict
sysctl kernel.kptr_restrict
sysctl net.ipv4.conf.all.accept_redirects
sysctl net.ipv4.tcp_syncookies
sysctl kernel.modules_disabled
```

Comparar los valores efectivos con las directivas previstas y comprobar que no existen errores de aplicación.

### 7.4. Comprobar los servicios de auditoría

```bash
sudo systemctl status auditd
sudo systemctl status sysstat
sudo systemctl status fail2ban
```

Consultar las reglas de auditoría:

```bash
sudo auditctl -l
```

Consultar el estado de Fail2ban:

```bash
sudo fail2ban-client status
```

### 7.5. Comprobar AIDE

```bash
sudo aide --check
```

Esta comprobación permite comparar el estado actual de los archivos con la base de referencia disponible. Debe realizarse después de verificar que la inicialización se ha completado correctamente y que la base de datos utilizada es confiable.

### 7.6. Comprobar los permisos de archivos

```bash
stat -c '%a %n' /etc/crontab
stat -c '%a %n' /usr/bin/gcc
stat -c '%a %n' /usr/bin/g++
stat -c '%a %n' /usr/bin/make
```

Comprobar también los permisos de los archivos de claves SSH si existen.

## 8. Limitaciones conocidas y riesgos operativos

El script automatiza diversas medidas de endurecimiento, pero no constituye por sí mismo una solución integral de seguridad.

Deben tenerse en cuenta las siguientes limitaciones:

1. **Modificación de archivos existentes:** varios archivos de configuración se sobrescriben o modifican directamente. No existe un mecanismo general de copia de seguridad y restauración.

2. **Directivas duplicadas:** el script añade parámetros a determinados archivos sin reconciliarlos con la configuración existente. Esto puede producir valores efectivos distintos de los esperados.

3. **Gestión de errores:** los fallos de comandos externos se registran, pero no provocan necesariamente la interrupción del proceso.

4. **Compatibilidad:** las rutas, los paquetes y las configuraciones utilizadas están orientados a un entorno basado en Debian, con supuestos específicos sobre repositorios y servicios.

5. **Riesgo de pérdida de acceso:** el cambio de puerto SSH y la desactivación de la autenticación mediante contraseña pueden impedir el acceso remoto si no se prepara previamente una clave válida y se comprueba la conectividad.

6. **Restricciones del kernel:** deshabilitar la carga de módulos durante el arranque puede interferir con servicios y componentes que necesiten cargar módulos posteriormente.

7. **Persistencia del firewall:** guardar reglas no garantiza que sean compatibles con todas las configuraciones de Docker, IPv6 o con otros gestores de reglas.

8. **Protección incompleta de servicios:** la instalación de herramientas de seguridad no garantiza su configuración, supervisión ni mantenimiento continuado.

9. **Dependencias externas:** el script descarga claves y reglas desde Internet. La integridad, procedencia y compatibilidad de esos recursos deben verificarse.

10. **Ausencia de reversión integral:** únicamente se crea una copia de seguridad específica para la configuración SSH, bajo determinadas condiciones. No se implementa una restauración completa de los cambios realizados.

Por estas razones, se recomienda adaptar y validar el script antes de utilizarlo en un servidor que preste servicios reales.

## 9. Recomendaciones de mejora

Para evolucionar el proyecto hacia una herramienta de endurecimiento más robusta, se recomienda:

- Incorporar un modo de simulación que permita revisar los cambios antes de aplicarlos.
- Crear copias de seguridad de todos los archivos de configuración que se vayan a modificar.
- Comprobar las directivas existentes y actualizar sus valores en lugar de añadir entradas duplicadas.
- Implementar una gestión centralizada de errores que permita detener el proceso cuando falle una operación crítica.
- Validar la configuración efectiva de SSH antes de reiniciar el servicio.
- Incorporar una comprobación de conectividad antes de aplicar cambios que puedan bloquear el acceso remoto.
- Revisar la compatibilidad de las reglas de Netfilter con Docker y con el tráfico IPv6.
- Validar las reglas externas de `auditd` antes de instalarlas.
- Configurar las herramientas de auditoría para que dispongan de políticas, tareas programadas y mecanismos de revisión adecuados.
- Añadir un registro estructurado de las operaciones realizadas y de sus resultados.
- Implementar comprobaciones posteriores para verificar que cada medida se ha aplicado correctamente.
- Incorporar pruebas en máquinas virtuales que permitan evaluar los efectos de cada fase por separado.

## 10. Uso responsable

Este script está destinado a tareas de administración segura, mantenimiento y endurecimiento de sistemas sobre los que se dispone de autorización.

Su ejecución debe realizarse con conocimiento de los cambios introducidos y de sus posibles efectos sobre los servicios existentes.

En entornos de producción, se recomienda establecer una ventana de mantenimiento, disponer de copias de seguridad verificadas y garantizar un mecanismo de recuperación antes de aplicar las modificaciones.

## 11. Conclusión

`hardening-linux.py` proporciona una base de automatización para aplicar diferentes medidas de endurecimiento en un sistema Linux basado en Debian.

Su enfoque combina políticas de autenticación, restricciones del kernel, eliminación de componentes innecesarios, herramientas de auditoría, controles de integridad, configuración de SSH y filtrado de tráfico de red.

El principal valor del script reside en centralizar distintas tareas administrativas de seguridad en un único procedimiento reproducible. No obstante, su eficacia depende de la compatibilidad del entorno, de la correcta aplicación de cada configuración y de las verificaciones posteriores.

Para utilizarlo en escenarios reales, es fundamental complementar la automatización con pruebas controladas, validación de las políticas efectivas, supervisión continua y procedimientos de recuperación.

---

**Nombre del archivo:** `hardening-linux.py`  
**Tipo de proyecto:** Automatización de seguridad y endurecimiento de sistemas Linux  
**Lenguaje:** Python 3  
**Entorno objetivo:** Sistemas basados en Debian  
**Ámbito:** Administración segura de sistemas, auditoría y reducción de la superficie de ataque