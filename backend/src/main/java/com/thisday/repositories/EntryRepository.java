package com.thisday.repositories;

import com.thisday.db.Collections;
import com.thisday.models.Entry;
import io.vertx.core.*;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.mongo.MongoClient;
import io.vertx.ext.mongo.MongoClientUpdateResult;

import java.time.Instant;
import java.util.List;

public class EntryRepository {

    private final MongoClient mongo;

    public EntryRepository(MongoClient mongo) {
        this.mongo = mongo;
    }

    public Future<Void> insert(Entry entry) {
        Promise<Void> promise = Promise.promise();
        mongo.insert(Collections.ENTRIES, entry.toJson(), ar -> {
            if (ar.succeeded()) {
                promise.complete();
            } else {
                promise.fail(ar.cause());
            }
        });
        return promise.future();
    }

    public Future<String> insertAndReturnId(Entry entry) {
        Promise<String> promise = Promise.promise();
        mongo.insert(Collections.ENTRIES, entry.toJson(), ar -> {
            if (ar.succeeded()) {
                promise.complete(ar.result());
            } else {
                promise.fail(ar.cause());
            }
        });
        return promise.future();
    }

    public Future<Entry> findById(
            String entryId,
            String userId
    ) {
        Promise<Entry> promise = Promise.promise();
        JsonObject query = new JsonObject()
                .put("_id", entryId)
                .put("userId", userId);

        mongo.findOne(Collections.ENTRIES, query, null, ar -> {
            if (ar.failed()) {
                promise.fail(ar.cause());
                return;
            }

            JsonObject doc = ar.result();

            if (doc == null) {
                promise.complete(null);
                return;
            }

            promise.complete(Entry.from(doc));
        });
        return promise.future();
    }


    public Future<Void> updateEntry(
            String entryId,
            String userId,
            String caption,
            List<String> addAssetIds,
            List<String> removeAssetIds
    ) {
        Promise<Void> promise = Promise.promise();
        JsonObject update = new JsonObject();

        if (caption != null) {
            update.put("caption", caption);
        }

        update.put("updatedAt", Instant.now().toString());

        JsonObject updateDoc = new JsonObject()
                .put("$set", update);

        if (!addAssetIds.isEmpty()) {
            updateDoc.put("$push", new JsonObject()
                    .put("immichAssetIds",
                            new JsonObject().put("$each", addAssetIds)));
        }

        if (!removeAssetIds.isEmpty()) {
            updateDoc.put("$pull", new JsonObject()
                    .put("immichAssetIds",
                            new JsonObject().put("$in", removeAssetIds)));
        }

        mongo.updateCollection(
                Collections.ENTRIES,
                new JsonObject().put("_id", entryId).put("userId", userId),
                updateDoc,
                ar -> {
                    if (ar.succeeded()) {
                        promise.complete();
                    } else {
                        promise.fail(ar.cause());
                    }
                }
        );
        return promise.future();
    }

    public Future<Entry> appendUploadedAsset(
            String entryId,
            String userId,
            String assetId
    ) {
        Promise<Entry> promise = Promise.promise();

        JsonObject query = new JsonObject()
                .put("_id", entryId)
                .put("userId", userId);

        JsonObject updateDoc = new JsonObject()
                .put("$push", new JsonObject().put("immichAssetIds", assetId))
                .put("$inc", new JsonObject().put("uploadedMediaCount", 1))
                .put("$set", new JsonObject().put("updatedAt", Instant.now().toString()));

        mongo.updateCollection(Collections.ENTRIES, query, updateDoc, ar -> {
            if (ar.failed()) {
                promise.fail(ar.cause());
                return;
            }

            MongoClientUpdateResult result = ar.result();
            if (result == null || result.getDocMatched() == 0) {
                promise.fail("Entry not found");
                return;
            }

            findById(entryId, userId).onComplete(findAr -> {
                if (findAr.failed()) {
                    promise.fail(findAr.cause());
                    return;
                }

                Entry entry = findAr.result();
                if (entry == null) {
                    promise.fail("Entry not found");
                    return;
                }

                promise.complete(entry);
            });
        });

        return promise.future();
    }

    public Future<Void> markReady(
            String entryId,
            String userId
    ) {
        Promise<Void> promise = Promise.promise();

        JsonObject query = new JsonObject()
                .put("_id", entryId)
                .put("userId", userId);

        JsonObject updateDoc = new JsonObject()
                .put("$set", new JsonObject()
                        .put("status", Entry.STATUS_READY)
                        .put("updatedAt", Instant.now().toString()));

        mongo.updateCollection(Collections.ENTRIES, query, updateDoc, ar -> {
            if (ar.failed()) {
                promise.fail(ar.cause());
                return;
            }

            MongoClientUpdateResult result = ar.result();
            if (result == null || result.getDocMatched() == 0) {
                promise.fail("Entry not found");
                return;
            }

            promise.complete();
        });

        return promise.future();
    }

    public Future<Void> delete(
            String entryId,
            String userId
    ) {
        Promise<Void> promise = Promise.promise();
        mongo.removeDocument(
                Collections.ENTRIES,
                new JsonObject().put("_id", entryId).put("userId", userId),
                ar -> {
                    if (ar.succeeded()) {
                        promise.complete();
                    } else {
                        promise.fail(ar.cause());
                    }
                }
        );
        return promise.future();
    }
}
