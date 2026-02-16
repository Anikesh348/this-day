package com.thisday.repositories;

import com.thisday.db.Collections;
import com.thisday.db.MongoProvider;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
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

        /* =========================================================
           1️⃣ Exact day (SOURCE OF TRUTH = date)
           ========================================================= */
        public Future<JsonArray> findByExactDay(
                String userId, int year, int month, int day
        ) {
                String date = String.format("%04d-%02d-%02d", year, month, day);

                JsonObject query = new JsonObject()
                        .put("userId", userId)
                        .put("date", date);

                return mongo.find(Collections.ENTRIES, query)
                        .map(JsonArray::new);
        }

        /* =========================================================
           2️⃣ Same day – previous months (same year)
           ========================================================= */
        public Future<JsonArray> findSameDayPreviousMonths(
                String userId, int year, int month, int day
        ) {
                String yearPrefix = String.format("%04d-", year);
                String daySuffix = String.format("-%02d", day);
                String cutoffDate = String.format("%04d-%02d-%02d", year, month, day);

                JsonArray pipeline = new JsonArray()

                        // 1️⃣ Match same user + same year + same day-of-month
                        .add(new JsonObject().put("$match",
                                new JsonObject()
                                        .put("userId", userId)
                                        .put("date", new JsonObject()
                                                .put("$regex", "^" + yearPrefix + ".*" + daySuffix + "$")
                                                .put("$lt", cutoffDate)
                                        )
                        ))

                        // 2️⃣ Add helper flags
                        .add(addMediaCaptionFlags())

                        // 3️⃣ Extract month from date string
                        .add(new JsonObject().put("$addFields",
                                new JsonObject().put("month",
                                        new JsonObject().put("$toInt",
                                                new JsonObject().put("$substr",
                                                        new JsonArray().add("$date").add(5).add(2)
                                                )
                                        )
                                )
                        ))

                        // 4️⃣ Best-first per month
                        .add(bestFirstSort("month"))

                        // 5️⃣ One entry per month
                        .add(groupFirstBy("$month"))
                        .add(replaceRoot())

                        // 6️⃣ Final order
                        .add(new JsonObject().put("$sort",
                                new JsonObject().put("date", 1)
                        ));

                return aggregate(pipeline);
        }

        /* =========================================================
           3️⃣ Same day – previous years
           ========================================================= */
        public Future<JsonArray> findSameDayBestEntriesPerYear(
                String userId, int year, int month, int day
        ) {
                String dayMonth = String.format("%02d-%02d", month, day);
                String today = String.format("%04d-%02d-%02d", year, month, day);

                JsonArray pipeline = new JsonArray()

                        // 1️⃣ Match same dayMonth, before today
                        .add(new JsonObject().put("$match",
                                new JsonObject()
                                        .put("userId", userId)
                                        .put("dayMonth", dayMonth)
                                        .put("date", new JsonObject().put("$lt", today))
                        ))

                        // 2️⃣ Add helper flags
                        .add(addMediaCaptionFlags())

                        // 3️⃣ Extract year from date string
                        .add(new JsonObject().put("$addFields",
                                new JsonObject().put("year",
                                        new JsonObject().put("$toInt",
                                                new JsonObject().put("$substr",
                                                        new JsonArray().add("$date").add(0).add(4)
                                                )
                                        )
                                )
                        ))

                        // 4️⃣ Best-first per year
                        .add(bestFirstSort("year"))

                        // 5️⃣ One entry per year
                        .add(groupFirstBy("$year"))
                        .add(replaceRoot())

                        // 6️⃣ Final order
                        .add(new JsonObject().put("$sort",
                                new JsonObject().put("date", 1)
                        ));

                return aggregate(pipeline);
        }

        /* =========================================================
           4️⃣ Day summary (best entry for date)
           ========================================================= */
        public Future<JsonArray> findTodaySummary(
                String userId, int year, int month, int day
        ) {
                String date = String.format("%04d-%02d-%02d", year, month, day);

                JsonArray pipeline = new JsonArray()

                        .add(new JsonObject().put("$match",
                                new JsonObject()
                                        .put("userId", userId)
                                        .put("date", date)
                        ))

                        .add(addMediaCaptionFlags())
                        .add(bestFirstSort(null))
                        .add(new JsonObject().put("$limit", 1));

                return aggregate(pipeline);
        }

        /* =========================================================
           5️⃣ Calendar view (one entry per date)
           ========================================================= */
        public Future<JsonArray> findCalendarEntries(
                String userId, int year, int month
        ) {
                String monthPrefix = String.format("%04d-%02d", year, month);

                JsonArray pipeline = new JsonArray()

                        .add(new JsonObject().put("$match",
                                new JsonObject()
                                        .put("userId", userId)
                                        .put("date", new JsonObject()
                                                .put("$regex", "^" + monthPrefix))
                        ))

                        .add(new JsonObject().put("$sort",
                                new JsonObject().put("createdAt", 1)
                        ))

                        .add(new JsonObject().put("$group",
                                new JsonObject()
                                        .put("_id", "$date")
                                        .put("allAssets",
                                                new JsonObject().put("$push", "$immichAssetIds"))
                                        .put("hasCaptionFlag",
                                                new JsonObject().put("$max",
                                                        new JsonObject().put("$cond",
                                                                new JsonArray()
                                                                        .add(hasCaptionExpr())
                                                                        .add(1)
                                                                        .add(0)
                                                        )
                                                )
                                        )
                        ))

                        .add(new JsonObject().put("$project",
                                new JsonObject()
                                        .put("date", "$_id")
                                        .put("hasEntries", true)
                                        .put("hasCaption",
                                                new JsonObject().put("$eq",
                                                        new JsonArray()
                                                                .add("$hasCaptionFlag")
                                                                .add(1)
                                                )
                                        )
                                        .put("immichAssetId", firstValidAssetExpr())
                        ));

                return aggregate(pipeline);
        }

    /* =========================================================
       Helpers (UNCHANGED LOGIC)
       ========================================================= */

        private JsonObject bestFirstSort(String primary) {
                JsonObject sort = new JsonObject();
                if (primary != null) {
                        sort.put(primary, 1);
                }
                sort.put("hasMedia", -1)
                        .put("hasCaption", -1)
                        .put("createdAt", 1);
                return new JsonObject().put("$sort", sort);
        }

        private JsonObject groupFirstBy(String field) {
                return new JsonObject().put("$group",
                        new JsonObject()
                                .put("_id", field)
                                .put("entry", new JsonObject().put("$first", "$$ROOT"))
                );
        }

        private JsonObject replaceRoot() {
                return new JsonObject().put("$replaceRoot",
                        new JsonObject().put("newRoot", "$entry")
                );
        }

        private JsonObject addMediaCaptionFlags() {
                return new JsonObject().put("$addFields",
                        new JsonObject()
                                .put("hasMedia", hasMediaExpr())
                                .put("hasCaption", hasCaptionExpr())
                );
        }

        private JsonObject hasMediaExpr() {
                return new JsonObject().put("$gt", new JsonArray()
                        .add(new JsonObject().put("$size",
                                new JsonObject().put("$filter",
                                        new JsonObject()
                                                .put("input", "$immichAssetIds")
                                                .put("as", "id")
                                                .put("cond", new JsonObject().put("$ne",
                                                        new JsonArray().add("$$id").add(null)
                                                ))
                                )
                        ))
                        .add(0)
                );
        }

        private JsonObject hasCaptionExpr() {
                return new JsonObject().put("$gt", new JsonArray()
                        .add(new JsonObject().put("$strLenCP",
                                new JsonObject().put("$ifNull",
                                        new JsonArray().add("$caption").add("")
                                )
                        ))
                        .add(0)
                );
        }

        private JsonObject firstValidAssetExpr() {
                return new JsonObject().put("$arrayElemAt", new JsonArray()
                        .add(new JsonObject().put("$filter",
                                new JsonObject()
                                        .put("input", new JsonObject().put("$reduce",
                                                new JsonObject()
                                                        .put("input", "$allAssets")
                                                        .put("initialValue", new JsonArray())
                                                        .put("in", new JsonObject().put("$concatArrays",
                                                                new JsonArray()
                                                                        .add("$$value")
                                                                        .add("$$this")
                                                        ))
                                        ))
                                        .put("as", "a")
                                        .put("cond", new JsonObject().put("$ne",
                                                new JsonArray().add("$$a").add(null)
                                        ))
                        ))
                        .add(0)
                );
        }

        private Future<JsonArray> aggregate(JsonArray pipeline) {
                Promise<JsonArray> promise = Promise.promise();
                List<JsonObject> results = new ArrayList<>();

                mongo.aggregate(Collections.ENTRIES, pipeline)
                        .handler(results::add)
                        .exceptionHandler(promise::fail)
                        .endHandler(v -> promise.complete(new JsonArray(results)));

                return promise.future();
        }
}
