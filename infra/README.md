# Guía de Conexión SSH Segura y Bastionada

Este documento resume el procedimiento técnico seguido para establecer una conexión SSH segura mediante el uso exclusivo de pares de claves pública/privada hacia la máquina virtual con Kali Linux, respetando las políticas de bastionado aplicadas previamente.

---

## 1. Configuración de Red (Reenvío de Puertos en VirtualBox)
Dado que la máquina virtual opera bajo un entorno aislado (modo NAT con IP interna `10.0.2.15`), es necesario establecer un puente perimetral desde el host anfitrión (Windows):
- Se configuró el **Reenvío de Puertos (Port Forwarding)** en VirtualBox.
- Todo el tráfico dirigido al puerto seguro personalizado **`22022`** de la interfaz local (`127.0.0.1`) se redirige de manera transparente al puerto `22022` del invitado.

---

## 2. Generación del Par de Claves Criptográficas
En el equipo anfitrión (Windows), se generó el par de claves mediante criptografía asimétrica estándar:
```cmd
ssh-keygen -t rsa -b 4096
```
* Esto genera dos ficheros en el perfil local (`C:\Users\User\.ssh\`):
  - `id_rsa`: Clave privada (mantenida de forma confidencial en el host).
  - `id_rsa.pub`: Clave pública (destinada a ser validada por el servidor).

---

## 3. Autorización y Respeto al Bastionado de OpenSSH
El script de bastionado ejecutado previamente deshabilitó por completo la autenticación tradicional por contraseña (`PasswordAuthentication no`), exigiendo obligatoriamente identificación por clave pública.

Para registrar la identidad de confianza:
1. Se copió el contenido de la clave pública generada en Windows (`id_rsa.pub`).
2. Se registró e insertó dicha clave dentro del archivo de autorizaciones del servidor remoto:
   ```bash
   mkdir -p ~/.ssh
   nano ~/.ssh/authorized_keys
   ```
3. Se aplicaron los permisos estrictos obligatorios requeridos por las políticas de seguridad:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

---

## 4. Ejecución de la Conexión Remota Segura
Una vez validada la identidad criptográfica y operativo el demonio de red, la conexión remota hacia el servidor bastionado se ejecuta desde el host local mediante el siguiente comando:

```cmd
ssh -i C:\Users\User\.ssh\id_rsa -p 22022 kali@127.0.0.1