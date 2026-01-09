package com.thisday.repositories;

import com.thisday.db.Collections;
import com.thisday.db.MongoProvider;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.mongo.FindOptions;
import io.vertx.ext.mongo.MongoClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

public class EntryReadRepository {

    private static final Logger log =
            LoggerFactory.getLogger(EntryReadRepository.class);

    private final MongoClient mongo;

    public EntryReadRepository(Vertx vertx) {
        this.mongo = MongoProvider.get(vertx);
    }

    /**
     * 1️⃣ Get all entries for a single day
     * Uses exact date match (YYYY-MM-DD)
     */
    public Future<JsonArray> findByExactDay(
            String userId, int year, int month, int day
    ) {
        String date =
                String.format("%04d-%02d-%02d", year, month, day);

        JsonObject query = new JsonObject()
                .put("userId", userId)
                .put("date", date);

        log.debug("Mongo findByExactDay query={}", query);

        return mongo.find(Collections.ENTRIES, query)
                .onSuccess(res ->
                        log.debug("findByExactDay returned {} entries", res.size()))
                .onFailure(err ->
                        log.error("Mongo findByExactDay failed", err))
                .map(JsonArray::new);
    }

    /**
     * 2️⃣ Same day, previous months (same year)
     *
     * Example:
     *  - input: year=2026, month=5, day=9
     *  - dayMonth = "05-09"
     *  - date < "2026-05-09"
     */
    public Future<JsonArray> findSameDayPreviousMonths(
            String userId, int year, int month, int day
    ) {
        String yearPrefix = String.format("%04d-", year);
        String cutoffDate = String.format("%04d-%02d-%02d", year, month, day);
        String daySuffix = String.format("-%02d", day);

        JsonObject query = new JsonObject()
                .put("userId", userId)
                // same year
                .put("date", new JsonObject()
                        .put("$regex", "^" + yearPrefix)
                        .put("$lt", cutoffDate)
                )
                // same day of month
                .put("date", new JsonObject()
                        .put("$regex", "^" + yearPrefix + ".*" + daySuffix + "$")
                        .put("$lt", cutoffDate)
                );

        FindOptions options = new FindOptions()
                .setSort(new JsonObject().put("date", 1));

        log.debug("Mongo findSameDayPreviousMonths query={}", query);

        return mongo.findWithOptions(Collections.ENTRIES, query, options)
                .map(JsonArray::new);
    }


    /**
     * 3️⃣ Same day, previous years
     *
     * Uses dayMonth only (MM-DD)
     */
    public Future<JsonArray> findSameDayPreviousYears(
            String userId, int month, int day
    ) {
        String dayMonth =
                String.format("%02d-%02d", month, day);

        JsonObject query = new JsonObject()
                .put("userId", userId)
                .put("dayMonth", dayMonth);

        FindOptions options = new FindOptions()
                .setSort(new JsonObject().put("date", 1));

        log.debug("Mongo findSameDayPreviousYears query={}", query);

        return mongo.findWithOptions(Collections.ENTRIES, query, options)
                .onSuccess(res ->
                        log.debug("findSameDayPreviousYears returned {} entries", res.size()))
                .onFailure(err ->
                        log.error("Mongo findSameDayPreviousYears failed", err))
                .map(JsonArray::new);
    }

    /**
     * 4️⃣ Calendar-wise entries
     *
     * One entry per date (first created entry of the day)
     * Used for calendar thumbnails
     */
    public Future<JsonArray> findCalendarEntries(
            String userId, int year, int month
    ) {
        Promise<JsonArray> promise = Promise.promise();

        String monthPrefix =
                String.format("%04d-%02d", year, month);

        JsonArray pipeline = new JsonArray()

                // 1️⃣ Match user + month
                .add(new JsonObject().put("$match", new JsonObject()
                        .put("userId", userId)
                        .put("date", new JsonObject()
                                .put("$regex", "^" + monthPrefix))
                ))

                // 2️⃣ Sort so earlier entries come first
                .add(new JsonObject().put("$sort", new JsonObject()
                        .put("createdAt", 1)
                ))

                // 3️⃣ Group by date
                .add(new JsonObject().put("$group", new JsonObject()
                        .put("_id", "$date")
                        .put("allAssets", new JsonObject()
                                .put("$push", "$immichAssetIds"))
                ))

                // 4️⃣ Flatten asset arrays
                .add(new JsonObject().put("$project", new JsonObject()
                        .put("date", "$_id")
                        .put("flatAssets", new JsonObject()
                                .put("$reduce", new JsonObject()
                                        .put("input", "$allAssets")
                                        .put("initialValue", new JsonArray())
                                        .put("in", new JsonObject()
                                                .put("$concatArrays",
                                                        new JsonArray()
                                                                .add("$$value")
                                                                .add("$$this"))
                                        )
                                )
                        )
                ))

                // 5️⃣ Filter out nulls
                .add(new JsonObject().put("$project", new JsonObject()
                        .put("date", 1)
                        .put("validAssets", new JsonObject()
                                .put("$filter", new JsonObject()
                                        .put("input", "$flatAssets")
                                        .put("as", "asset")
                                        .put("cond", new JsonObject()
                                                .put("$ne", new JsonArray()
                                                        .add("$$asset")
                                                        .add(null)))
                                )
                        )
                ))

                // 6️⃣ Final shape for UI
                .add(new JsonObject().put("$project", new JsonObject()
                        .put("date", 1)
                        .put("hasEntries", new JsonObject().put("$literal", true))
                        .put("immichAssetId", new JsonObject()
                                .put("$arrayElemAt",
                                        new JsonArray()
                                                .add("$validAssets")
                                                .add(0)))
                ));

        log.debug("Mongo findCalendarEntries pipeline={}", pipeline);

        List<JsonObject> results = new ArrayList<>();

        mongo.aggregate(Collections.ENTRIES, pipeline)
                .handler(results::add)
                .exceptionHandler(err -> {
                    log.error("Mongo findCalendarEntries failed", err);
                    promise.fail(err);
                })
                .endHandler(v -> {
                    log.debug("findCalendarEntries returned {} days", results.size());
                    promise.complete(new JsonArray(results));
                });

        return promise.future();
    }

}
