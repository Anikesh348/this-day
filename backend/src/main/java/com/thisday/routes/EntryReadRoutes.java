package com.thisday.routes;

import com.thisday.auth.AuthHandler;
import com.thisday.services.EntryReadService;
import io.vertx.core.json.JsonArray;
import io.vertx.ext.web.Router;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class EntryReadRoutes {

    private static final Logger log =
            LoggerFactory.getLogger(EntryReadRoutes.class);

    public static void mount(
            Router router,
            AuthHandler authHandler,
            EntryReadService entryReadService
    ) {

        // 1️⃣ Get all entries for a single day
        router.get("/api/entries/day")
                .handler(authHandler)
                .handler(ctx -> {

                    String userId =
                            ctx.<io.vertx.core.json.JsonObject>get("authUser")
                                    .getString("sub");

                    int year = Integer.parseInt(ctx.request().getParam("year"));
                    int month = Integer.parseInt(ctx.request().getParam("month"));
                    int day = Integer.parseInt(ctx.request().getParam("day"));

                    log.info(
                            "Fetching entries for single day user={} date={}-{}-{}",
                            userId, year, month, day
                    );

                    entryReadService.getEntriesForDay(
                            userId, year, month, day, ar -> {
                                if (ar.failed()) {
                                    log.error("Get entries for day failed", ar.cause());
                                    ctx.fail(500);
                                } else {
                                    ctx.response()
                                            .putHeader("Content-Type", "application/json")
                                            .end(ar.result().encode());
                                }
                            }
                    );
                });

        // 2️⃣ Same day, previous months (same year only)
        router.get("/api/entries/same-day/previous-months")
                .handler(authHandler)
                .handler(ctx -> {

                    String userId =
                            ctx.<io.vertx.core.json.JsonObject>get("authUser")
                                    .getString("sub");

                    int year = Integer.parseInt(ctx.request().getParam("year"));
                    int month = Integer.parseInt(ctx.request().getParam("month"));
                    int day = Integer.parseInt(ctx.request().getParam("day"));

                    log.info(
                            "Fetching same-day previous months user={} date={}-{}-{}",
                            userId, year, month, day
                    );

                    entryReadService.getSameDayPreviousMonths(
                            userId, year, month, day, ar -> {
                                if (ar.failed()) {
                                    log.error("Get same-day previous months failed", ar.cause());
                                    ctx.fail(500);
                                } else {
                                    ctx.response()
                                            .putHeader("Content-Type", "application/json")
                                            .end(ar.result().encode());
                                }
                            }
                    );
                });

        // 3️⃣ Same day, previous years
        router.get("/api/entries/same-day/previous-years")
                .handler(authHandler)
                .handler(ctx -> {

                    String userId =
                            ctx.<io.vertx.core.json.JsonObject>get("authUser")
                                    .getString("sub");

                    int month = Integer.parseInt(ctx.request().getParam("month"));
                    int day = Integer.parseInt(ctx.request().getParam("day"));

                    log.info(
                            "Fetching same-day previous years user={} dayMonth={}-{}",
                            userId, month, day
                    );

                    entryReadService.getSameDayPreviousYears(
                            userId, month, day, ar -> {
                                if (ar.failed()) {
                                    log.error("Get same-day previous years failed", ar.cause());
                                    ctx.fail(500);
                                } else {
                                    ctx.response()
                                            .putHeader("Content-Type", "application/json")
                                            .end(ar.result().encode());
                                }
                            }
                    );
                });

        // 4️⃣ Calendar-wise entries
        router.get("/api/entries/calendar")
                .handler(authHandler)
                .handler(ctx -> {

                    String userId =
                            ctx.<io.vertx.core.json.JsonObject>get("authUser")
                                    .getString("sub");

                    int year = Integer.parseInt(ctx.request().getParam("year"));
                    int month = Integer.parseInt(ctx.request().getParam("month"));

                    log.info(
                            "Fetching calendar entries user={} year={} month={}",
                            userId, year, month
                    );

                    entryReadService.getCalendarEntries(
                            userId, year, month, ar -> {
                                if (ar.failed()) {
                                    log.error("Get calendar entries failed", ar.cause());
                                    ctx.fail(500);
                                } else {
                                    ctx.response()
                                            .putHeader("Content-Type", "application/json")
                                            .end(ar.result().encode());
                                }
                            }
                    );
                });
    }
}
