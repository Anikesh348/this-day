package com.thisday.db;

import com.thisday.config.AppConfig;
import io.vertx.core.Vertx;
import io.vertx.ext.mongo.MongoClient;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MongoProvider {

    private static final Logger log =
            LoggerFactory.getLogger(MongoProvider.class);

    private static MongoClient client;

    public static MongoClient get(Vertx vertx) {
        if (client == null) {
            log.info("Initializing MongoClient");

            JsonObject config = new JsonObject()
                    .put("connection_string", AppConfig.MONGO_URI)
                    .put("db_name", AppConfig.MONGO_DB);

            client = MongoClient.createShared(vertx, config);

            log.info("MongoClient initialized successfully [db={}]", AppConfig.MONGO_DB);
        } else {
            log.debug("Reusing existing MongoClient instance");
        }
        return client;
    }
}
