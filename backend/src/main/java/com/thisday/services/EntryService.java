package com.thisday.services;

import com.thisday.immich.ImmichClient;
import com.thisday.models.Entry;
import com.thisday.repositories.EntryRepository;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.multipart.MultipartForm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

public class EntryService {

    private static final Logger log = LoggerFactory.getLogger(EntryService.class);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final ImmichClient immichClient;
    private final EntryRepository entryRepository;

    public EntryService(
            ImmichClient immichClient,
            EntryRepository entryRepository) {
        this.immichClient = immichClient;
        this.entryRepository = entryRepository;
    }

    // CREATE
    public Future<Void> createEntry(
            String userId,
            String caption,
            List<MultipartForm> media) {
        return uploadAssets(media, new ArrayList<>()).compose(assetIds -> {
            LocalDate todayIst = LocalDate.now(IST);

            Entry entry = new Entry();
            entry.userId = userId;
            entry.caption = caption;
            entry.immichAssetIds = assetIds;
            entry.uploadedClientMediaIds = new ArrayList<>();
            entry.date = todayIst;
            entry.dayMonth = String.format(
                    "%02d-%02d",
                    todayIst.getMonthValue(),
                    todayIst.getDayOfMonth());
            entry.status = Entry.STATUS_READY;
            entry.expectedMediaCount = assetIds.size();
            entry.uploadedMediaCount = assetIds.size();
            entry.createdAt = Instant.now(); // UTC

            return entryRepository.insert(entry);
        });
    }

    public Future<Void> createPastEntry(
            String userId,
            LocalDate date,
            String caption,
            List<MultipartForm> media) {
        LocalDate todayIst = LocalDate.now(IST);

        if (date.isAfter(todayIst)) {
            return Future.failedFuture("Cannot create entry for a future date");
        }

        return uploadAssets(media, new ArrayList<>()).compose(assetIds -> {
            Entry entry = new Entry();
            entry.userId = userId;
            entry.caption = caption;
            entry.immichAssetIds = assetIds;
            entry.uploadedClientMediaIds = new ArrayList<>();
            entry.date = date;
            entry.dayMonth = String.format(
                    "%02d-%02d",
                    date.getMonthValue(),
                    date.getDayOfMonth());
            entry.status = Entry.STATUS_READY;
            entry.expectedMediaCount = assetIds.size();
            entry.uploadedMediaCount = assetIds.size();
            entry.createdAt = Instant.now();

            return entryRepository.insert(entry);
        });
    }

    public Future<String> initEntryUploadSession(
            String userId,
            LocalDate date,
            String caption,
            int expectedMediaCount
    ) {
        LocalDate todayIst = LocalDate.now(IST);
        if (date.isAfter(todayIst)) {
            return Future.failedFuture("Cannot create entry for a future date");
        }
        if (expectedMediaCount < 0) {
            return Future.failedFuture("expectedMediaCount must be >= 0");
        }

        Entry entry = new Entry();
        entry.userId = userId;
        entry.caption = caption;
        entry.date = date;
        entry.dayMonth = String.format(
                "%02d-%02d",
                date.getMonthValue(),
                date.getDayOfMonth());
        entry.immichAssetIds = new ArrayList<>();
        entry.uploadedClientMediaIds = new ArrayList<>();
        entry.status = Entry.STATUS_PENDING;
        entry.expectedMediaCount = expectedMediaCount;
        entry.uploadedMediaCount = 0;
        entry.createdAt = Instant.now();
        entry.updatedAt = Instant.now();

        return entryRepository.insertAndReturnId(entry);
    }

    public Future<JsonObject> uploadPendingEntryMedia(
            String entryId,
            String userId,
            MultipartForm media,
            String clientMediaId
    ) {
        return entryRepository.findById(entryId, userId).compose(entry -> {
            if (entry == null) {
                return Future.failedFuture("Entry not found");
            }
            if (!Entry.STATUS_PENDING.equals(entry.status)) {
                return Future.failedFuture("Entry is not pending");
            }
            String normalizedClientMediaId =
                    clientMediaId == null ? "" : clientMediaId.trim();

            if (!normalizedClientMediaId.isBlank()) {
                String existingAssetId =
                        findExistingAssetForClientMediaId(entry, normalizedClientMediaId);
                if (existingAssetId != null) {
                    return Future.succeededFuture(new JsonObject()
                            .put("assetId", existingAssetId)
                            .put("uploadedMediaCount", entry.uploadedMediaCount)
                            .put("expectedMediaCount", entry.expectedMediaCount)
                            .put("deduplicated", true));
                }
            }

            if (entry.uploadedMediaCount >= entry.expectedMediaCount) {
                return Future.failedFuture("Upload limit reached for this entry");
            }

            return immichClient.uploadAsset(media).compose(assetId ->
                    entryRepository.appendUploadedAsset(
                                    entryId,
                                    userId,
                                    assetId,
                                    normalizedClientMediaId)
                            .map(updated ->
                            new JsonObject()
                                    .put("assetId", assetId)
                                    .put("uploadedMediaCount", updated.uploadedMediaCount)
                                    .put("expectedMediaCount", updated.expectedMediaCount)
                                    .put("deduplicated", false)
                    ));
        });
    }

    public Future<Void> finalizePendingEntry(
            String entryId,
            String userId
    ) {
        return entryRepository.findById(entryId, userId).compose(entry -> {
            if (entry == null) {
                return Future.failedFuture("Entry not found");
            }

            if (Entry.STATUS_READY.equals(entry.status)) {
                return Future.succeededFuture();
            }

            if (!Entry.STATUS_PENDING.equals(entry.status)) {
                return Future.failedFuture("Entry is not pending");
            }

            if (entry.uploadedMediaCount != entry.expectedMediaCount) {
                return Future.failedFuture("Upload incomplete");
            }

            return entryRepository.markReady(entryId, userId);
        });
    }

    // UPDATE
    public Future<Void> updateEntry(
            String entryId,
            String userId,
            String caption,
            List<MultipartForm> newMedia,
            List<String> removeAssetIds) {
        return uploadAssets(newMedia, new ArrayList<>()).compose(assetIds ->
                entryRepository.updateEntry(
                        entryId,
                        userId,
                        caption,
                        assetIds,
                        removeAssetIds
                )
        );
    }

    // DELETE (hard)
    public Future<Void> deleteEntry(
            String entryId,
            String userId) {
        return entryRepository.findById(entryId, userId).compose(entry -> {
            if (entry == null) {
                return Future.failedFuture("Entry not found");
            }

            // Optional: delete assets from Immich here
            // immichClient.deleteAssets(entry.immichAssetIds);

            return entryRepository.delete(entryId, userId);
        });
    }

    private Future<List<String>> uploadAssets(
            List<MultipartForm> forms,
            List<String> assetIds) {
        if (forms.isEmpty()) {
            return Future.succeededFuture(assetIds);
        }

        MultipartForm form = forms.remove(0);

        return immichClient.uploadAsset(form).compose(assetId -> {
            assetIds.add(assetId);
            return uploadAssets(forms, assetIds);
        });
    }

    private String findExistingAssetForClientMediaId(
            Entry entry,
            String clientMediaId
    ) {
        if (entry.uploadedClientMediaIds == null || entry.immichAssetIds == null) {
            return null;
        }

        int index = entry.uploadedClientMediaIds.indexOf(clientMediaId);
        if (index < 0 || index >= entry.immichAssetIds.size()) {
            return null;
        }

        return entry.immichAssetIds.get(index);
    }
}
