FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app

COPY BarHub-0.0.1-SNAPSHOT.jar app.jar

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]