# ======= BUILD STAGE =======
FROM gradle:8.8-jdk21 AS build

WORKDIR /app

# Copy entire project
COPY . .

# Ensure no accidental env leakage during build
RUN rm -f .env

# Build fat jar (ShadowJar)
RUN ./gradlew shadowJar --no-daemon


# ======= RUNTIME STAGE =======
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# Install curl for health checks
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the built fat jar
COPY --from=build /app/build/libs/*-all.jar app.jar

# Copy runtime env file (mounted or baked in)
COPY .env .env

# Health check endpoint (restart policy in compose)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8081/health || (kill -s TERM 1 && exit 1)

# Run the app
CMD ["java", "-jar", "app.jar"]
