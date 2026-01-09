package com.thisday.services;

import com.thisday.immich.ImmichClient;
import com.thisday.models.Entry;
import com.thisday.repositories.EntryRepository;
import io.vertx.core.*;
import io.vertx.ext.web.multipart.MultipartForm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class EntryService {

    private static final Logger log =
            LoggerFactory.getLogger(EntryService.class);

    private final ImmichClient immichClient;
    private final EntryRepository entryRepository;

    public EntryService(
            ImmichClient immichClient,
            EntryRepository entryRepository
    ) {
        this.immichClient = immichClient;
        this.entryRepository = entryRepository;
    }

    // CREATE
    public void createEntry(
            String userId,
            String caption,
            List<MultipartForm> media,
            Handler<AsyncResult<Void>> handler
    ) {
        uploadAssets(media, new ArrayList<>(), ar -> {
            if (ar.failed()) {
                handler.handle(Future.failedFuture(ar.cause()));
                return;
            }

            LocalDate today = LocalDate.now();

            Entry entry = new Entry();
            entry.userId = userId;
            entry.caption = caption;
            entry.immichAssetIds = ar.result();
            entry.date = today;
            entry.dayMonth = String.format("%02d-%02d",
                    today.getMonthValue(), today.getDayOfMonth());
            entry.createdAt = Instant.now();

            entryRepository.insert(entry, handler);
        });
    }

    public void createPastEntry(
            String userId,
            LocalDate date,
            String caption,
            List<MultipartForm> media,
            Handler<AsyncResult<Void>> handler
    ) {

        LocalDate today = LocalDate.now();

        if (date.isAfter(today)) {
            handler.handle(
                    Future.failedFuture("Cannot create entry for a future date")
            );
            return;
        }

        uploadAssets(media, new ArrayList<>(), ar -> {
            if (ar.failed()) {
                handler.handle(Future.failedFuture(ar.cause()));
                return;
            }

            Entry entry = new Entry();
            entry.userId = userId;
            entry.caption = caption;
            entry.immichAssetIds = ar.result();
            entry.date = date;
            entry.dayMonth = String.format(
                    "%02d-%02d",
                    date.getMonthValue(),
                    date.getDayOfMonth()
            );
            entry.createdAt = Instant.now();

            entryRepository.insert(entry, handler);
        });
    }


    // UPDATE
    public void updateEntry(
            String entryId,
            String userId,
            String caption,
            List<MultipartForm> newMedia,
            List<String> removeAssetIds,
            Handler<AsyncResult<Void>> handler
    ) {
        uploadAssets(newMedia, new ArrayList<>(), ar -> {
            if (ar.failed()) {
                handler.handle(Future.failedFuture(ar.cause()));
                return;
            }

            entryRepository.updateEntry(
                    entryId,
                    userId,
                    caption,
                    ar.result(),
                    removeAssetIds,
                    handler
            );
        });
    }

    // DELETE (hard)
    public void deleteEntry(
            String entryId,
            String userId,
            Handler<AsyncResult<Void>> handler
    ) {
        entryRepository.findById(entryId, userId, ar -> {
            if (ar.failed() || ar.result() == null) {
                handler.handle(Future.failedFuture("Entry not found"));
                return;
            }

            Entry entry = ar.result();

            // Optional: delete assets from Immich here
            // immichClient.deleteAssets(entry.immichAssetIds);

            entryRepository.delete(entryId, userId, handler);
        });
    }

    private void uploadAssets(
            List<MultipartForm> forms,
            List<String> assetIds,
            Handler<AsyncResult<List<String>>> handler
    ) {
        if (forms.isEmpty()) {
            handler.handle(Future.succeededFuture(assetIds));
            return;
        }

        MultipartForm form = forms.remove(0);

        immichClient.uploadAsset(form, ar -> {
            if (ar.failed()) {
                handler.handle(Future.failedFuture(ar.cause()));
                return;
            }

            assetIds.add(ar.result());
            uploadAssets(forms, assetIds, handler);
        });
    }
}
