package com.thisday.services;

import com.thisday.immich.ImmichClient;
import com.thisday.models.Entry;
import com.thisday.repositories.EntryRepository;
import io.vertx.core.Future;
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

            ZoneId IST = ZoneId.of("Asia/Kolkata");
            LocalDate todayIst = LocalDate.now(IST);

            Entry entry = new Entry();
            entry.userId = userId;
            entry.caption = caption;
            entry.immichAssetIds = assetIds;

            entry.date = todayIst;

            entry.dayMonth = String.format(
                    "%02d-%02d",
                    todayIst.getMonthValue(),
                    todayIst.getDayOfMonth());

            entry.createdAt = Instant.now(); // UTC

            return entryRepository.insert(entry);
        });
    }

    public Future<Void> createPastEntry(
            String userId,
            LocalDate date,
            String caption,
            List<MultipartForm> media) {
        ZoneId IST = ZoneId.of("Asia/Kolkata");
        LocalDate todayIst = LocalDate.now(IST);

        if (date.isAfter(todayIst)) {
            return Future.failedFuture("Cannot create entry for a future date");
        }

        return uploadAssets(media, new ArrayList<>()).compose(assetIds -> {
            Entry entry = new Entry();
            entry.userId = userId;
            entry.caption = caption;
            entry.immichAssetIds = assetIds;
            entry.date = date;
            entry.dayMonth = String.format(
                    "%02d-%02d",
                    date.getMonthValue(),
                    date.getDayOfMonth());
            entry.createdAt = Instant.now();

            return entryRepository.insert(entry);
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
}
