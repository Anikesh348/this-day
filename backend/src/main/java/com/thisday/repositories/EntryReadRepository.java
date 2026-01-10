package com.thisday.repositories;

import com.thisday.db.Collections;
import com.thisday.db.MongoProvider;
import com.thisday.util.TimeUtil;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.mongo.MongoClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class EntryReadRepository {

        private static final Logger log = LoggerFactory.getLogger(EntryReadRepository.class);

        private final MongoClient mongo;

        public EntryReadRepository(Vertx vertx) {
                this.mongo = MongoProvider.get(vertx);
        }

        /*
         * =========================================================
         * 1️⃣ Exact IST day
         * =========================================================
         */
        public Future<JsonArray> findByExactDay(
                        String userId, int year, int month, int day) {
                Instant startUtc = TimeUtil.istStartToUtc(year, month, day);
                Instant endUtc = TimeUtil.istEndToUtc(year, month, day);

                JsonObject query = new JsonObject()
                                .put("userId", userId)
                                .put("createdAt", new JsonObject()
                                                .put("$gte", startUtc.toString())
                                                .put("$lte", endUtc.toString()));

                return mongo.find(Collections.ENTRIES, query)
                                .map(list -> normalizeDatesToIst(new JsonArray(list)));
        }

        /*
         * =========================================================
         * 2️⃣ Same day – previous months
         * =========================================================
         */
        public Future<JsonArray> findSameDayPreviousMonths(
                        String userId, int year, int month, int day) {
                Instant todayStartUtc = TimeUtil.istStartToUtc(year, month, day);

                JsonArray pipeline = new JsonArray()
                                .add(matchUserAndBefore(userId, todayStartUtc))
                                .add(addIstParts())
                                .add(new JsonObject().put("$match",
                                                new JsonObject()
                                                                .put("ist.day", day)
                                                                .put("ist.month", new JsonObject().put("$lt", month))))
                                .add(bestFirstSort("ist.month"))
                                .add(groupFirstBy("$ist.month"))
                                .add(replaceRoot());

                return aggregateAndNormalize(pipeline);
        }

        /*
         * =========================================================
         * 3️⃣ Same day – previous years
         * =========================================================
         */
        public Future<JsonArray> findSameDayBestEntriesPerYear(
                        String userId, int year, int month, int day) {
                Instant todayStartUtc = TimeUtil.istStartToUtc(year, month, day);

                JsonArray pipeline = new JsonArray()
                                .add(matchUserAndBefore(userId, todayStartUtc))
                                .add(addIstParts())
                                .add(new JsonObject().put("$match",
                                                new JsonObject()
                                                                .put("ist.day", day)
                                                                .put("ist.month", month)))
                                .add(bestFirstSort("ist.year"))
                                .add(groupFirstBy("$ist.year"))
                                .add(replaceRoot());

                return aggregateAndNormalize(pipeline);
        }

        /*
         * =========================================================
         * 4️⃣ Today summary
         * =========================================================
         */
        public Future<JsonArray> findTodaySummary(
                        String userId, int year, int month, int day) {
                Instant startUtc = TimeUtil.istStartToUtc(year, month, day);
                Instant endUtc = TimeUtil.istEndToUtc(year, month, day);

                JsonArray pipeline = new JsonArray()
                                .add(new JsonObject().put("$match",
                                                new JsonObject()
                                                                .put("userId", userId)
                                                                .put("createdAt", new JsonObject()
                                                                                .put("$gte", startUtc.toString())
                                                                                .put("$lte", endUtc.toString()))))
                                .add(addMediaCaptionFlags())
                                .add(bestFirstSort(null))
                                .add(new JsonObject().put("$limit", 1));

                return aggregateAndNormalize(pipeline);
        }

        /*
         * =========================================================
         * 5️⃣ Calendar view
         * =========================================================
         */
        public Future<JsonArray> findCalendarEntries(
                        String userId, int year, int month) {
                LocalDate firstDay = LocalDate.of(year, month, 1);
                LocalDate lastDay = firstDay.withDayOfMonth(firstDay.lengthOfMonth());

                Instant startUtc = firstDay.atStartOfDay(TimeUtil.IST).toInstant();
                Instant endUtc = lastDay.atTime(LocalTime.MAX)
                                .atZone(TimeUtil.IST)
                                .toInstant();

                JsonArray pipeline = new JsonArray()
                                .add(new JsonObject().put("$match",
                                                new JsonObject()
                                                                .put("userId", userId)
                                                                .put("createdAt", new JsonObject()
                                                                                .put("$gte", startUtc.toString())
                                                                                .put("$lte", endUtc.toString()))))
                                .add(new JsonObject().put("$addFields",
                                                new JsonObject().put("ist",
                                                                new JsonObject().put("$dateToParts",
                                                                                new JsonObject()
                                                                                                .put("date", new JsonObject()
                                                                                                                .put("$toDate", "$createdAt"))
                                                                                                .put("timezone", "Asia/Kolkata")))))
                                .add(new JsonObject().put("$group",
                                                new JsonObject()
                                                                .put("_id", new JsonObject().put("$dateToString",
                                                                                new JsonObject()
                                                                                                .put("format", "%Y-%m-%d")
                                                                                                .put("date", new JsonObject()
                                                                                                                .put("$toDate", "$createdAt"))
                                                                                                .put("timezone", "Asia/Kolkata")))
                                                                .put("allAssets",
                                                                                new JsonObject().put("$push",
                                                                                                "$immichAssetIds"))))
                                .add(new JsonObject().put("$project",
                                                new JsonObject()
                                                                .put("date", "$_id")
                                                                .put("hasEntries", true)
                                                                .put("immichAssetId", firstValidAssetExpr())));

                return aggregate(pipeline);
        }

        /*
         * =========================================================
         * Helpers
         * =========================================================
         */

        private JsonObject matchUserAndBefore(String userId, Instant beforeUtc) {
                return new JsonObject().put("$match",
                                new JsonObject()
                                                .put("userId", userId)
                                                .put("createdAt", new JsonObject()
                                                                .put("$lt", beforeUtc.toString())));
        }

        private JsonObject addIstParts() {
                return new JsonObject().put("$addFields",
                                new JsonObject().put("ist",
                                                new JsonObject().put("$dateToParts",
                                                                new JsonObject()
                                                                                .put("date", new JsonObject().put(
                                                                                                "$toDate",
                                                                                                "$createdAt"))
                                                                                .put("timezone", "Asia/Kolkata"))));
        }

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
                                                .put("entry", new JsonObject().put("$first", "$$ROOT")));
        }

        private JsonObject replaceRoot() {
                return new JsonObject().put("$replaceRoot",
                                new JsonObject().put("newRoot", "$entry"));
        }

        private JsonObject addMediaCaptionFlags() {
                return new JsonObject().put("$addFields",
                                new JsonObject()
                                                .put("hasMedia", hasMediaExpr())
                                                .put("hasCaption", hasCaptionExpr()));
        }

        private JsonObject hasMediaExpr() {
                return new JsonObject().put("$gt", new JsonArray()
                                .add(new JsonObject().put("$size",
                                                new JsonObject().put("$filter",
                                                                new JsonObject()
                                                                                .put("input", "$immichAssetIds")
                                                                                .put("as", "id")
                                                                                .put("cond", new JsonObject().put("$ne",
                                                                                                new JsonArray().add(
                                                                                                                "$$id")
                                                                                                                .add(null))))))
                                .add(0));
        }

        private JsonObject hasCaptionExpr() {
                return new JsonObject().put("$gt", new JsonArray()
                                .add(new JsonObject().put("$strLenCP",
                                                new JsonObject().put("$ifNull",
                                                                new JsonArray().add("$caption").add(""))))
                                .add(0));
        }

        private JsonObject firstValidAssetExpr() {
                return new JsonObject().put("$arrayElemAt", new JsonArray()
                                .add(new JsonObject().put("$filter",
                                                new JsonObject()
                                                                .put("input", new JsonObject().put("$reduce",
                                                                                new JsonObject()
                                                                                                .put("input", "$allAssets")
                                                                                                .put("initialValue",
                                                                                                                new JsonArray())
                                                                                                .put("in", new JsonObject()
                                                                                                                .put("$concatArrays",
                                                                                                                                new JsonArray()
                                                                                                                                                .add("$$value")
                                                                                                                                                .add("$$this")))))
                                                                .put("as", "a")
                                                                .put("cond", new JsonObject().put("$ne",
                                                                                new JsonArray().add("$$a").add(null)))))
                                .add(0));
        }

        private Future<JsonArray> aggregateAndNormalize(JsonArray pipeline) {
                return aggregate(pipeline)
                                .map(this::normalizeDatesToIst);
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

        private JsonArray normalizeDatesToIst(JsonArray docs) {
                for (int i = 0; i < docs.size(); i++) {
                        JsonObject doc = docs.getJsonObject(i);
                        if (doc.containsKey("createdAt")) {
                                Instant utc = Instant.parse(doc.getString("createdAt"));
                                doc.put("date", TimeUtil.utcInstantToIstDate(utc));
                        }
                }
                return docs;
        }
}
