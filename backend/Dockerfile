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

# Copy the built fat jar
COPY --from=build /app/build/libs/*-all.jar app.jar

# Copy runtime env file (mounted or baked in)
COPY .env .env

# Run the app
CMD ["java", "-jar", "app.jar"]
