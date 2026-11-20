#!/bin/bash
# Solo se ejecuta al crear el volumen de datos por primera vez (docker-entrypoint-initdb.d).
# El script se carga con "source" desde el entrypoint de MariaDB, por eso puede usar docker_process_sql.
# Obliga a que el usuario de la aplicacion se conecte siempre con TLS: una conexion sin cifrar se rechaza.
usuario_app="${MARIADB_USER:-$MYSQL_USER}"
docker_process_sql --database=mysql <<-EOSQL
	ALTER USER '${usuario_app}'@'%' REQUIRE SSL;
EOSQL
