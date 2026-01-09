package com.thisday.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.thisday.config.AppConfig;
import io.vertx.core.*;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.interfaces.RSAPublicKey;

public class ClerkJwtVerifier {

    private static final Logger log =
            LoggerFactory.getLogger(ClerkJwtVerifier.class);

    private final Vertx vertx;
    private JsonObject jwksCache;

    public ClerkJwtVerifier(Vertx vertx) {
        this.vertx = vertx;
        log.info("ClerkJwtVerifier initialized");
    }

    public void verify(String token, Handler<AsyncResult<JsonObject>> handler) {
        if (jwksCache == null) {
            log.info("JWKS cache empty, fetching JWKS from Clerk");
            fetchJwks(ar -> {
                if (ar.failed()) {
                    log.error("Failed to fetch JWKS from Clerk", ar.cause());
                    handler.handle(Future.failedFuture(ar.cause()));
                    return;
                }
                log.info("JWKS fetched and cached successfully");
                verifyInternal(token, handler);
            });
        } else {
            log.debug("Using cached JWKS for token verification");
            verifyInternal(token, handler);
        }
    }

    private void fetchJwks(Handler<AsyncResult<Void>> handler) {
        WebClient.create(vertx)
                .getAbs(AppConfig.CLERK_JWKS_URL)
                .send(ar -> {
                    if (ar.failed()) {
                        log.error(
                                "Error calling Clerk JWKS endpoint: {}",
                                AppConfig.CLERK_JWKS_URL,
                                ar.cause()
                        );
                        handler.handle(Future.failedFuture(ar.cause()));
                        return;
                    }
                    jwksCache = ar.result().bodyAsJsonObject();
                    log.info("JWKS loaded into memory cache");
                    handler.handle(Future.succeededFuture());
                });
    }

    private void verifyInternal(String token, Handler<AsyncResult<JsonObject>> handler) {
        try {
            DecodedJWT jwt = JWT.decode(token);

            log.debug(
                    "Decoded JWT [kid={}, iss={}]",
                    jwt.getKeyId(),
                    jwt.getIssuer()
            );

            Algorithm algorithm = Algorithm.RSA256(
                    (RSAPublicKey) JwkUtil.getPublicKey(jwksCache, jwt.getKeyId()),
                    null
            );

            algorithm.verify(jwt);

            log.debug("JWT signature verification successful");

            JsonObject claimsJson = new JsonObject();

            jwt.getClaims().forEach((key, claim) -> {
                if (claim.isNull()) return;

                if (claim.asString() != null) {
                    claimsJson.put(key, claim.asString());
                } else if (claim.asBoolean() != null) {
                    claimsJson.put(key, claim.asBoolean());
                } else if (claim.asLong() != null) {
                    claimsJson.put(key, claim.asLong());
                } else if (claim.asInt() != null) {
                    claimsJson.put(key, claim.asInt());
                } else if (claim.asDouble() != null) {
                    claimsJson.put(key, claim.asDouble());
                } else if (claim.asMap() != null) {
                    claimsJson.put(key, new JsonObject(claim.asMap()));
                } else if (claim.asList(Object.class) != null) {
                    claimsJson.put(key, claim.asList(Object.class));
                }
            });

            log.debug("JWT claims extracted successfully");

            handler.handle(Future.succeededFuture(claimsJson));
        } catch (Exception e) {
            log.warn("JWT verification failed", e);
            handler.handle(Future.failedFuture(e));
        }
    }
}
