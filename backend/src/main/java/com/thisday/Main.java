package com.thisday;

import com.thisday.verticles.ThisDayVerticle;
import io.vertx.core.Vertx;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Main {

    private static final Logger log =
            LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) {
        log.info("Application starting");

        Vertx vertx = Vertx.vertx();

        vertx.deployVerticle(new ThisDayVerticle(), ar -> {
            if (ar.succeeded()) {
                log.info("ThisDayVerticle deployed successfully");
            } else {
                log.error("Failed to deploy ThisDayVerticle", ar.cause());
            }
        });
    }
}
