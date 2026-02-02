package com.thisday.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AppConfig {

    private static final Logger log =
            LoggerFactory.getLogger(AppConfig.class);

    private static final Dotenv dotenv = Dotenv.configure()
            .ignoreIfMissing()
            .load();

    static {
        log.info("AppConfig initialization started");
    }

    private static String env(String key, String defaultValue) {
        String value = System.getenv(key);
        if (value != null && !value.isBlank()) {
            log.debug("Loaded config from system env [key={}]", key);
            return value;
        }

        if (defaultValue != null) {
            String dotenvValue = dotenv.get(key, defaultValue);
            if (dotenvValue != null) {
                log.debug("Loaded config from dotenv [key={}]", key);
            }
            return dotenvValue;
        }

        String dotenvValue = dotenv.get(key);
        if (dotenvValue != null) {
            log.debug("Loaded config from dotenv [key={}]", key);
        }

        return dotenvValue;
    }

    private static String require(String key) {
        String value = env(key, null);
        if (value == null || value.isBlank()) {
            log.error("Required environment variable missing [key={}]", key);
            throw new IllegalStateException(
                    "Missing required environment variable: " + key
            );
        }
        log.info("Required environment variable loaded [key={}]", key);
        return value;
    }

    public static final String HTTP_PORT =
            env("HTTP_PORT", "8081");

    public static final String MONGO_URI =
            require("MONGO_URI");

    public static final String MONGO_DB =
            env("MONGO_DB", "thisday");

    public static final String CLERK_ISSUER =
            require("CLERK_ISSUER");

    public static final String CLERK_JWKS_URL =
            CLERK_ISSUER.endsWith("/")
                    ? CLERK_ISSUER + ".well-known/jwks.json"
                    : CLERK_ISSUER + "/.well-known/jwks.json";

    public static final String IMMICH_BASE_URL = require("IMMICH_BASE_URL");
    public static final String IMMICH_API_KEY = require("IMMICH_API_KEY");

    public static final String CORS_ALLOWED_ORIGINS =
            env("CORS_ALLOWED_ORIGINS",
                    "https://thisdayui.hostingfrompurva.xyz,http://localhost:19006,http://localhost:3000");

    static {
        log.info("AppConfig initialization completed");
    }
}
