# Evidencia: conexión cifrada entre el backend y MariaDB

Fecha: 20 de noviembre de 2026. Instancia local con Docker Compose.

| Componente | Versión |
|---|---|
| Base de datos | MariaDB 13.0 (imagen `mariadb:13.0`) |
| Driver del backend | MariaDB Connector/J 4.0.0 |
| Backend | Spring Boot 4.2.0 |

## Qué se comprueba

1. El usuario de la aplicación está obligado a conectarse con TLS (`REQUIRE SSL`).
2. Con TLS, la conexión usa TLS 1.3.
3. Sin TLS, la conexión se rechaza.
4. Con esa obligación activa, el backend arranca y la aplicación funciona con normalidad, de modo que su propia conexión va cifrada.

El driver usa por defecto `sslMode=verify-full`: cifra y además verifica el certificado del servidor. MariaDB (desde la 11.4) genera su certificado al arrancar, y el driver lo valida durante el login usando la contraseña como secreto compartido, sin instalar certificados a mano.

## Resultados

En las salidas, `juan` es el usuario de la aplicación en esta instancia local.

**1. TLS obligatorio para el usuario de la aplicación**

```text
$ docker exec barhub-mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mariadb -uroot -h127.0.0.1 -e "ALTER USER \"$MYSQL_USER\"@\"%\" REQUIRE SSL; SELECT user, host, ssl_type FROM mysql.user WHERE user=\"$MYSQL_USER\";"'
User    Host    ssl_type
juan    %       ANY
```

**2. Conexión con TLS**

```text
$ docker exec barhub-mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mariadb -u"$MYSQL_USER" -h127.0.0.1 -e "SHOW SESSION STATUS LIKE \"Ssl_version\";"'
Variable_name   Value
Ssl_version     TLSv1.3
```

**3. Conexión sin TLS: rechazada**

```text
$ docker exec barhub-mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mariadb -u"$MYSQL_USER" -h127.0.0.1 --skip-ssl -e "SELECT 1"'
ERROR 1045 (28000): Access denied for user 'juan'@'127.0.0.1' (using password: YES)
```

**4. El backend arranca con la obligación activa**

```text
$ docker compose restart backend
barhub-backend  | ... Started BarHubApplication in 10.57 seconds (process running for 11.265)
```

Después, las capturas automáticas de las 36 pantallas, en tema claro y oscuro, salen idénticas a las tomadas antes del cambio de driver. La aplicación lee y escribe en la base de datos con normalidad.

| Comprobación | Resultado |
|---|---|
| `ssl_type` del usuario de la aplicación | `ANY` (TLS obligatorio) |
| Versión de TLS | TLS 1.3 |
| Conexión sin cifrar | Rechazada (`ERROR 1045`) |
| Backend con TLS obligatorio | Arranca y funciona |

## Cómo reproducirlo

Con los contenedores levantados (`infra/docker`), ejecuta los comandos de los puntos 1 a 4. En una instalación nueva el punto 1 ya lo aplica `infra/docker/initdb/10-tls-obligatorio.sh` al crear el volumen de datos.
