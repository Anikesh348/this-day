package com.thisday.routes;

import com.thisday.auth.AuthHandler;
import com.thisday.models.Entry;
import com.thisday.services.EntryService;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.multipart.MultipartForm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

public class EntryRoutes {

    private static final Logger log = LoggerFactory.getLogger(EntryRoutes.class);

    public static void mount(
            Router router,
            AuthHandler authHandler,
            EntryService entryService) {

        router.post("/api/entries/init")
                .handler(authHandler)
                .handler(ctx -> {
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");
                    JsonObject body = ctx.body().asJsonObject();
                    if (body == null) {
                        body = new JsonObject();
                    }

                    String caption = body.getString("caption", "");
                    String dateStr = body.getString("date");
                    Integer expectedMediaCount = body.getInteger("expectedMediaCount");

                    if (expectedMediaCount == null || expectedMediaCount < 0) {
                        ctx.response()
                                .setStatusCode(400)
                                .putHeader("Content-Type", "application/json")
                                .end(new JsonObject()
                                        .put("error", "expectedMediaCount must be >= 0")
                                        .encode());
                        return;
                    }

                    LocalDate date = LocalDate.now(ZoneId.of("Asia/Kolkata"));
                    if (dateStr != null && !dateStr.isBlank()) {
                        try {
                            date = LocalDate.parse(dateStr);
                        } catch (Exception ex) {
                            ctx.response()
                                    .setStatusCode(400)
                                    .putHeader("Content-Type", "application/json")
                                    .end(new JsonObject().put("error", "Invalid date").encode());
                            return;
                        }
                    }

                    entryService.initEntryUploadSession(userId, date, caption, expectedMediaCount)
                            .onComplete(ar -> {
                                if (ar.failed()) {
                                    failWithMessage(ctx, ar.cause(), "Init entry upload session failed");
                                    return;
                                }

                                ctx.response()
                                        .setStatusCode(201)
                                        .putHeader("Content-Type", "application/json")
                                        .end(new JsonObject()
                                                .put("entryId", ar.result())
                                                .put("status", Entry.STATUS_PENDING)
                                                .put("uploadedMediaCount", 0)
                                                .put("expectedMediaCount", expectedMediaCount)
                                                .encode());
                            });
                });

        router.post("/api/entries/:entryId/media")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {
                    String entryId = ctx.pathParam("entryId");
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    List<MultipartForm> forms = buildForms(ctx.fileUploads(), userId);
                    if (forms.isEmpty()) {
                        ctx.response()
                                .setStatusCode(400)
                                .putHeader("Content-Type", "application/json")
                                .end(new JsonObject()
                                        .put("error", "No media file found")
                                        .encode());
                        return;
                    }
                    if (forms.size() > 1) {
                        ctx.response()
                                .setStatusCode(400)
                                .putHeader("Content-Type", "application/json")
                                .end(new JsonObject()
                                        .put("error", "Upload one file per request")
                                        .encode());
                        return;
                    }

                    entryService.uploadPendingEntryMedia(entryId, userId, forms.get(0))
                            .onComplete(ar -> {
                                if (ar.failed()) {
                                    failWithMessage(ctx, ar.cause(), "Upload media to pending entry failed");
                                    return;
                                }

                                ctx.response()
                                        .setStatusCode(200)
                                        .putHeader("Content-Type", "application/json")
                                        .end(ar.result().encode());
                            });
                });

        router.post("/api/entries/:entryId/finalize")
                .handler(authHandler)
                .handler(ctx -> {
                    String entryId = ctx.pathParam("entryId");
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    entryService.finalizePendingEntry(entryId, userId).onComplete(ar -> {
                        if (ar.failed()) {
                            failWithMessage(ctx, ar.cause(), "Finalize entry upload session failed");
                            return;
                        }

                        ctx.response().setStatusCode(204).end();
                    });
                });

        // CREATE ENTRY
        router.post("/api/entries")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");
                    String caption = ctx.request().getFormAttribute("caption");
                    List<MultipartForm> forms = buildForms(ctx.fileUploads(), userId);
                    entryService.createEntry(userId, caption, forms).onComplete(ar -> {
                        if (ar.failed()) {
                            ctx.fail(500);
                            log.error("Create entry failed", ar.cause());
                        } else {
                            ctx.response().setStatusCode(201).end();
                            log.info("entries have been adeded");
                        }
                    });
                });

        router.post("/api/entries/backfill")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {

                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    String caption = ctx.request().getFormAttribute("caption");

                    String dateStr = ctx.request().getFormAttribute("date"); // YYYY-MM-DD

                    if (dateStr == null || dateStr.isBlank()) {
                        ctx.fail(400);
                        return;
                    }

                    LocalDate date;
                    try {
                        date = LocalDate.parse(dateStr);
                    } catch (Exception e) {
                        ctx.fail(400);
                        return;
                    }

                    List<MultipartForm> forms = buildForms(ctx.fileUploads(), userId);
                    entryService.createPastEntry(
                            userId,
                            date,
                            caption,
                            forms
                    ).onComplete(ar -> {
                        if (ar.failed()) {
                            ctx.fail(500);
                            log.error("Create past entry failed", ar.cause());
                        } else {
                            ctx.response().setStatusCode(201).end();
                            log.info("entries have been added");
                        }
                    });
                });

        // UPDATE ENTRY (caption + add/remove media)
        router.put("/api/entries/:entryId")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {

                    String entryId = ctx.pathParam("entryId");
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    String caption = ctx.request().getFormAttribute("caption");

                    String removeAssetsRaw = ctx.request().getFormAttribute("removeAssetIds");

                    List<String> removeAssetIds = removeAssetsRaw == null
                            ? List.of()
                            : new JsonArray(removeAssetsRaw).getList();

                    List<MultipartForm> newMedia = buildForms(ctx.fileUploads(), userId);

                    entryService.updateEntry(
                            entryId,
                            userId,
                            caption,
                            newMedia,
                            removeAssetIds
                    ).onComplete(ar -> {
                        if (ar.failed()) {
                            log.error("Update entry failed", ar.cause());
                            ctx.fail(500);
                        } else {
                            ctx.response().setStatusCode(204).end();
                        }
                    });
                });

        // DELETE ENTRY (hard delete)
        router.delete("/api/entries/:entryId")
                .handler(authHandler)
                .handler(ctx -> {

                    String entryId = ctx.pathParam("entryId");
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    entryService.deleteEntry(entryId, userId).onComplete(ar -> {
                        if (ar.failed()) {
                            log.error("Delete entry failed", ar.cause());
                            ctx.fail(500);
                        } else {
                            ctx.response().setStatusCode(204).end();
                        }
                    });
        });
    }

    private static void failWithMessage(
            io.vertx.ext.web.RoutingContext ctx,
            Throwable cause,
            String logMessage
    ) {
        int status = statusCodeFor(cause);
        String message = cause == null ? "Unknown error" : String.valueOf(cause.getMessage());
        log.error(logMessage, cause);
        ctx.response()
                .setStatusCode(status)
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject().put("error", message).encode());
    }

    private static int statusCodeFor(Throwable cause) {
        if (cause == null || cause.getMessage() == null) {
            return 500;
        }
        String message = cause.getMessage().toLowerCase(Locale.ROOT);

        if (message.contains("not found")) {
            return 404;
        }
        if (message.contains("future date")
                || message.contains("invalid")
                || message.contains("expectedmediacount")) {
            return 400;
        }
        if (message.contains("not pending")
                || message.contains("limit reached")
                || message.contains("incomplete")) {
            return 409;
        }

        return 500;
    }

    private static List<MultipartForm> buildForms(
            List<io.vertx.ext.web.FileUpload> uploads,
            String userId) {
        List<MultipartForm> forms = new ArrayList<>();

        uploads.forEach(upload -> {
            MultipartForm form = MultipartForm.create()
                    .binaryFileUpload(
                            "assetData",
                            upload.fileName(),
                            upload.uploadedFileName(),
                            upload.contentType())
                    .attribute("deviceId", "thisday-backend-" + userId)
                    .attribute("deviceAssetId", UUID.randomUUID().toString())
                    .attribute("fileCreatedAt", Instant.now().toString())
                    .attribute("fileModifiedAt", Instant.now().toString());

            forms.add(form);
        });

        return forms;
    }
}
