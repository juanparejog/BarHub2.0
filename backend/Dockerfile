FROM openjdk:17-jdk-alpine
RUN addgroup -S spring && adduser -S spring -G spring
WORKDIR /app
USER spring:spring
ARG JAR_FILE=target/*.jar
COPY --chown=spring:spring ${JAR_FILE} app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app.jar"]