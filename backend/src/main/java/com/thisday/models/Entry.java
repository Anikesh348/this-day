package com.thisday.models;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class Entry {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_READY = "READY";

    public String id;
    public String userId;
    public String caption;

    public LocalDate date;
    public String dayMonth;

    public List<String> immichAssetIds;
    public List<String> uploadedClientMediaIds;
    public String status;
    public int expectedMediaCount;
    public int uploadedMediaCount;

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

        entry.immichAssetIds = readStringList(doc, "immichAssetIds");
        entry.uploadedClientMediaIds = readStringList(doc, "uploadedClientMediaIds");
        entry.status = doc.getString("status", STATUS_READY);
        entry.expectedMediaCount = doc.getInteger(
                "expectedMediaCount",
                entry.immichAssetIds == null ? 0 : entry.immichAssetIds.size());
        entry.uploadedMediaCount = doc.getInteger(
                "uploadedMediaCount",
                entry.immichAssetIds == null ? 0 : entry.immichAssetIds.size());

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
        json.put("uploadedClientMediaIds", uploadedClientMediaIds);
        json.put("status", status);
        json.put("expectedMediaCount", expectedMediaCount);
        json.put("uploadedMediaCount", uploadedMediaCount);

        if (createdAt != null) {
            json.put("createdAt", createdAt.toString());
        }

        if (updatedAt != null) {
            json.put("updatedAt", updatedAt.toString());
        }

        return json;
    }

    private static List<String> readStringList(JsonObject doc, String fieldName) {
        JsonArray array = doc.getJsonArray(fieldName, new JsonArray());
        List<String> values = new ArrayList<>();
        for (Object value : array) {
            if (value instanceof String str) {
                values.add(str);
            }
        }
        return values;
    }
}
