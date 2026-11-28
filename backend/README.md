# BarHub: backend

API REST de BarHub con Java 21 y Spring Boot 4.2. La documentación completa (arquitectura, endpoints, roles, pedidos, tiempo real y calidad) está en [docs/backend.md](../docs/backend.md), y el modelo de datos en [docs/base-de-datos.md](../docs/base-de-datos.md).

## Comandos

```bash
./gradlew test                       # tests unitarios y de integración, con cobertura (build/reports/jacoco)
./gradlew bootJar -x test            # jar en build/libs
./gradlew bootRun                    # arranca en http://localhost:8080 (necesita MariaDB y las variables de entorno)
```

Para desarrollar fuera de Docker Compose, `infra/mysql/docker-compose.yml` levanta una MariaDB suelta en `127.0.0.1:3306`, y `src/main/resources/env.properties` (no se versiona) puede llevar `DB_USERNAME`, `DB_PASSWORD` y `JWT_SECRET`. Para levantar la aplicación completa se usa Docker Compose desde `infra/docker`; ver el [README principal](../README.md).
