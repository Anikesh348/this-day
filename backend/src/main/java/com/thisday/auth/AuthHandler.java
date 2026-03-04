package com.thisday.auth;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AuthHandler implements Handler<RoutingContext> {

    private static final Logger log =
            LoggerFactory.getLogger(AuthHandler.class);
    private static final String MEDIA_PATH_PREFIX = "/api/media/immich/";
    private static final String AUTH_COOKIE_NAME = "thisday_auth";
    private static final String X_FORWARDED_PROTO = "X-Forwarded-Proto";

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
        String token = extractBearerToken(header);

        if ((token == null || token.isBlank()) && path.startsWith(MEDIA_PATH_PREFIX)) {
            token = extractCookieToken(ctx);
        }

        if (token == null || token.isBlank()) {
            log.warn(
                    "Unauthorized request: missing auth credentials [method={}, path={}]",
                    method,
                    path
            );
            ctx.response().setStatusCode(401).end();
            return;
        }

        final String verifiedToken = token;
        final boolean tokenFromAuthorizationHeader =
                header != null && header.startsWith("Bearer ");

        log.debug(
                "Auth token found, starting JWT verification [method={}, path={}]",
                method,
                path
        );

        verifier.verify(verifiedToken).onComplete(ar -> {
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

            if (tokenFromAuthorizationHeader) {
                setAuthCookie(ctx, verifiedToken);
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

    private static String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }

        String token = authorizationHeader.substring(7).trim();
        return token.isBlank() ? null : token;
    }

    private static String extractCookieToken(RoutingContext ctx) {
        String cookieHeader = ctx.request().getHeader("Cookie");
        if (cookieHeader == null || cookieHeader.isBlank()) {
            return null;
        }

        String prefix = AUTH_COOKIE_NAME + "=";
        String[] cookies = cookieHeader.split(";");

        for (String cookie : cookies) {
            String part = cookie.trim();
            if (!part.startsWith(prefix)) {
                continue;
            }

            String token = part.substring(prefix.length()).trim();
            return token.isBlank() ? null : token;
        }

        return null;
    }

    private static void setAuthCookie(RoutingContext ctx, String token) {
        StringBuilder cookie = new StringBuilder()
                .append(AUTH_COOKIE_NAME)
                .append("=")
                .append(token)
                .append("; Path=/; HttpOnly; SameSite=Lax");

        if (isSecureRequest(ctx)) {
            cookie.append("; Secure");
        }

        ctx.response().headers().add("Set-Cookie", cookie.toString());
    }

    private static boolean isSecureRequest(RoutingContext ctx) {
        if (ctx.request().isSSL()) {
            return true;
        }

        String forwardedProto = ctx.request().getHeader(X_FORWARDED_PROTO);
        return forwardedProto != null && forwardedProto.equalsIgnoreCase("https");
    }
}
