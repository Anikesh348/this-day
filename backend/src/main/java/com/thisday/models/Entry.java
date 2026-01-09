package com.thisday.models;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class Entry {

    public String id;
    public String userId;
    public String caption;

    public LocalDate date;
    public String dayMonth;

    public List<String> immichAssetIds;

    public Instant createdAt;
    public Instant updatedAt;

    // ---------- Mongo → Model ----------
    public static Entry from(JsonObject doc) {
        Entry entry = new Entry();

        entry.id = doc.getString("_id");
        entry.userId = doc.getString("userId");
        entry.caption = doc.getString("caption");

        entry.date = LocalDate.parse(doc.getString("date"));
        entry.dayMonth = doc.getString("dayMonth");

        entry.immichAssetIds = doc
                .getJsonArray("immichAssetIds", new JsonArray())
                .getList();

        if (doc.getString("createdAt") != null) {
            entry.createdAt = Instant.parse(doc.getString("createdAt"));
        }

        if (doc.getString("updatedAt") != null) {
            entry.updatedAt = Instant.parse(doc.getString("updatedAt"));
        }

        return entry;
    }

    // ---------- Model → Mongo ----------
    public JsonObject toJson() {
        JsonObject json = new JsonObject();

        if (id != null) {
            json.put("_id", id);
        }

        json.put("userId", userId);
        json.put("caption", caption);
        json.put("date", date.toString());
        json.put("dayMonth", dayMonth);
        json.put("immichAssetIds", immichAssetIds);

        if (createdAt != null) {
            json.put("createdAt", createdAt.toString());
        }

        if (updatedAt != null) {
            json.put("updatedAt", updatedAt.toString());
        }

        return json;
    }
}
