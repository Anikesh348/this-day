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

    public void insert(Entry entry, Handler<AsyncResult<Void>> handler) {
        mongo.insert("entries", entry.toJson(), ar -> {
            handler.handle(ar.succeeded()
                    ? Future.succeededFuture()
                    : Future.failedFuture(ar.cause()));
        });
    }

    public void findById(
            String entryId,
            String userId,
            Handler<AsyncResult<Entry>> handler
    ) {
        JsonObject query = new JsonObject()
                .put("_id", entryId)
                .put("userId", userId);

        mongo.findOne("entries", query, null, ar -> {
            if (ar.failed()) {
                handler.handle(Future.failedFuture(ar.cause()));
                return;
            }

            JsonObject doc = ar.result();

            if (doc == null) {
                handler.handle(Future.succeededFuture(null));
                return;
            }

            handler.handle(Future.succeededFuture(Entry.from(doc)));
        });
    }


    public void updateEntry(
            String entryId,
            String userId,
            String caption,
            List<String> addAssetIds,
            List<String> removeAssetIds,
            Handler<AsyncResult<Void>> handler
    ) {
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
                ar -> handler.handle(ar.succeeded()
                        ? Future.succeededFuture()
                        : Future.failedFuture(ar.cause()))
        );
    }

    public void delete(
            String entryId,
            String userId,
            Handler<AsyncResult<Void>> handler
    ) {
        mongo.removeDocument(
                "entries",
                new JsonObject().put("_id", entryId).put("userId", userId),
                ar -> handler.handle(ar.succeeded()
                        ? Future.succeededFuture()
                        : Future.failedFuture(ar.cause()))
        );
    }
}
