package com.thisday.verticles;

import com.thisday.auth.*;
import com.thisday.config.AppConfig;
import com.thisday.db.MongoProvider;
import com.thisday.immich.ImmichClient;
import com.thisday.repositories.EntryRepository;
import com.thisday.repositories.UserRepository;
import com.thisday.routes.EntryReadRoutes;
import com.thisday.routes.MediaRoutes;
import com.thisday.routes.UserRoutes;
import com.thisday.routes.EntryRoutes;
import com.thisday.services.EntryReadService;
import com.thisday.services.EntryService;
import com.thisday.services.MediaService;
import com.thisday.services.UserService;
import io.vertx.core.*;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ThisDayVerticle extends AbstractVerticle {

    private static final Logger log =
            LoggerFactory.getLogger(ThisDayVerticle.class);

    @Override
    public void start() {
        log.info("Starting ThisDayVerticle");

        Router router = Router.router(vertx);
        router.route().handler(BodyHandler.create());
        log.debug("Router and BodyHandler initialized");

        log.info("Initializing MongoDB");
        var mongo = MongoProvider.get(vertx);

        var userRepo = new UserRepository(mongo);
        var userService = new UserService(userRepo);
        var entryRepo = new EntryRepository(mongo);
        var immichClient = new ImmichClient(vertx);
        var entryService = new EntryService(immichClient, entryRepo);
        var entryReadService = new EntryReadService(vertx);
        log.info("Initializing Clerk JWT verifier and auth handler");
        var jwtVerifier = new ClerkJwtVerifier(vertx);
        var authHandler = new AuthHandler(jwtVerifier);

        UserRoutes.mount(router, authHandler, userService);
        EntryRoutes.mount(router, authHandler, entryService);
        EntryReadRoutes.mount(router, authHandler, entryReadService);
        MediaRoutes.mount(
                router,
                authHandler,
                new MediaService(vertx)
        );

        int port = Integer.parseInt(AppConfig.HTTP_PORT);
        log.info("Starting HTTP server on port {}", port);

        vertx.createHttpServer()
                .requestHandler(router)
                .listen(port, ar -> {
                    if (ar.succeeded()) {
                        log.info("HTTP server started successfully on port {}", port);
                    } else {
                        log.error("Failed to start HTTP server on port {}", port, ar.cause());
                    }
                });
    }
}
