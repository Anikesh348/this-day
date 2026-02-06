package com.thisday.auth;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AuthHandler implements Handler<RoutingContext> {

    private static final Logger log =
            LoggerFactory.getLogger(AuthHandler.class);

    private final ClerkJwtVerifier verifier;

    public AuthHandler(ClerkJwtVerifier verifier) {
        this.verifier = verifier;
        log.info("AuthHandler initialized");
    }

    @Override
    public void handle(RoutingContext ctx) {
        String path = ctx.request().path();
        String method = ctx.request().method().name();

        String header = ctx.request().getHeader("Authorization");

        if (header == null || !header.startsWith("Bearer ")) {
            log.warn(
                    "Unauthorized request: missing or invalid Authorization header [method={}, path={}]",
                    method,
                    path
            );
            ctx.response().setStatusCode(401).end();
            return;
        }

        log.debug(
                "Authorization header found, starting JWT verification [method={}, path={}]",
                method,
                path
        );

        String token = header.substring(7);

        verifier.verify(token).onComplete(ar -> {
            if (ar.failed()) {
                log.warn(
                        "JWT verification failed [method={}, path={}]: {}",
                        method,
                        path,
                        ar.cause().getMessage()
                );
                ctx.response().setStatusCode(401).end();
                return;
            }

            log.debug(
                    "JWT verification successful [method={}, path={}]",
                    method,
                    path
            );

            ctx.put("authUser", ar.result());
            ctx.next();
        });
    }
}
