package com.thisday.repositories;

import com.thisday.models.Entry;
import io.vertx.core.*;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.mongo.MongoClient;

import java.time.Instant;
import java.util.List;

public class EntryRepository {

    private final MongoClient mongo;

    public EntryRepository(MongoClient mongo) {
        this.mongo = mongo;
    }

    public Future<Void> insert(Entry entry) {
        Promise<Void> promise = Promise.promise();
        mongo.insert("entries", entry.toJson(), ar -> {
            if (ar.succeeded()) {
                promise.complete();
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

        mongo.findOne("entries", query, null, ar -> {
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
                "entries",
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

    public Future<Void> delete(
            String entryId,
            String userId
    ) {
        Promise<Void> promise = Promise.promise();
        mongo.removeDocument(
                "entries",
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
