package com.thisday.repositories;

import com.thisday.models.User;
import io.vertx.core.*;
import io.vertx.ext.mongo.MongoClient;
import io.vertx.ext.mongo.UpdateOptions;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserRepository {

    private static final Logger log =
            LoggerFactory.getLogger(UserRepository.class);

    private final MongoClient mongo;

    public UserRepository(MongoClient mongo) {
        this.mongo = mongo;
        log.info("UserRepository initialized");
    }

    public void upsert(User user, Handler<AsyncResult<Void>> handler) {

        log.debug("Upserting user [id={}]", user.id);

        JsonObject query = new JsonObject()
                .put("_id", user.id);

        JsonObject update = new JsonObject()
                .put("$set", new JsonObject()
                        .put("email", user.email)
                        .put("name", user.name)
                        .put("role", user.role)
                        .put("avatarUrl", user.avatarUrl)
                        .put("updatedAt", user.updatedAt.toString())
                )
                .put("$setOnInsert", new JsonObject()
                        .put("createdAt", user.createdAt.toString())
                );

        UpdateOptions options = new UpdateOptions().setUpsert(true);

        mongo.updateCollectionWithOptions(
                "users",
                query,
                update,
                options,
                ar -> {
                    if (ar.failed()) {
                        log.error(
                                "Failed to upsert user [id={}]",
                                user.id,
                                ar.cause()
                        );
                        handler.handle(Future.failedFuture(ar.cause()));
                    } else {
                        log.debug("User upsert successful [id={}]", user.id);
                        handler.handle(Future.succeededFuture());
                    }
                }
        );
    }
}
