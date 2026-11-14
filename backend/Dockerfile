# Etapa 1: compilar el jar dentro de Docker
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
# Descarga las dependencias en su propia capa, para no repetirlo en cada cambio de código
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true
COPY src ./src
RUN ./gradlew --no-daemon bootJar -x test

# Etapa 2: imagen final, solo con JRE y sin privilegios
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S barhub && adduser -S barhub -G barhub \
 && mkdir -p /data/uploads/usuarios /data/uploads/productos \
 && chown -R barhub:barhub /data/uploads /app

COPY --from=build --chown=barhub:barhub /src/build/libs/BarHub-0.0.1-SNAPSHOT.jar app.jar

USER barhub

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/actuator/health || exit 1

EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","app.jar"]