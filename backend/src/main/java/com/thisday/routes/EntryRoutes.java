package com.thisday.routes;

import com.thisday.auth.AuthHandler;
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
import java.util.*;

public class EntryRoutes {

    private static final Logger log =
            LoggerFactory.getLogger(EntryRoutes.class);

    public static void mount(
            Router router,
            AuthHandler authHandler,
            EntryService entryService
    ) {

        // CREATE ENTRY
        router.post("/api/entries")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {

                    String userId = ctx.<JsonObject>get("authUser").getString("sub");
                    String caption = ctx.request().getFormAttribute("caption");

                    List<MultipartForm> forms = buildForms(ctx.fileUploads(), userId);

                    entryService.createEntry(userId, caption, forms, ar -> {
                        if (ar.failed()) {
                            log.error("Create entry failed", ar.cause());
                            ctx.fail(500);
                        } else {
                            ctx.response().setStatusCode(201).end();
                        }
                    });
                });


        router.post("/api/entries/backfill")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {

                    String userId =
                            ctx.<JsonObject>get("authUser").getString("sub");

                    String caption =
                            ctx.request().getFormAttribute("caption");

                    String dateStr =
                            ctx.request().getFormAttribute("date"); // YYYY-MM-DD

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

                    List<MultipartForm> forms =
                            buildForms(ctx.fileUploads(), userId);

                    entryService.createPastEntry(
                            userId,
                            date,
                            caption,
                            forms,
                            ar -> {
                                if (ar.failed()) {
                                    log.error("Create past entry failed", ar.cause());
                                    ctx.fail(500);
                                } else {
                                    ctx.response().setStatusCode(201).end();
                                }
                            }
                    );
                });


        // UPDATE ENTRY (caption + add/remove media)
        router.put("/api/entries/:entryId")
                .handler(BodyHandler.create().setDeleteUploadedFilesOnEnd(false))
                .handler(authHandler)
                .handler(ctx -> {

                    String entryId = ctx.pathParam("entryId");
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    String caption = ctx.request().getFormAttribute("caption");

                    String removeAssetsRaw =
                            ctx.request().getFormAttribute("removeAssetIds");

                    List<String> removeAssetIds =
                            removeAssetsRaw == null
                                    ? List.of()
                                    : new JsonArray(removeAssetsRaw).getList();

                    List<MultipartForm> newMedia =
                            buildForms(ctx.fileUploads(), userId);

                    entryService.updateEntry(
                            entryId,
                            userId,
                            caption,
                            newMedia,
                            removeAssetIds,
                            ar -> {
                                if (ar.failed()) {
                                    log.error("Update entry failed", ar.cause());
                                    ctx.fail(500);
                                } else {
                                    ctx.response().setStatusCode(204).end();
                                }
                            }
                    );
                });

        // DELETE ENTRY (hard delete)
        router.delete("/api/entries/:entryId")
                .handler(authHandler)
                .handler(ctx -> {

                    String entryId = ctx.pathParam("entryId");
                    String userId = ctx.<JsonObject>get("authUser").getString("sub");

                    entryService.deleteEntry(entryId, userId, ar -> {
                        if (ar.failed()) {
                            log.error("Delete entry failed", ar.cause());
                            ctx.fail(500);
                        } else {
                            ctx.response().setStatusCode(204).end();
                        }
                    });
                });
    }

    private static List<MultipartForm> buildForms(
            List<io.vertx.ext.web.FileUpload> uploads,
            String userId
    ) {
        List<MultipartForm> forms = new ArrayList<>();

        uploads.forEach(upload -> {
            MultipartForm form = MultipartForm.create()
                    .binaryFileUpload(
                            "assetData",
                            upload.fileName(),
                            upload.uploadedFileName(),
                            upload.contentType()
                    )
                    .attribute("deviceId", "thisday-backend-" + userId)
                    .attribute("deviceAssetId", UUID.randomUUID().toString())
                    .attribute("fileCreatedAt", Instant.now().toString())
                    .attribute("fileModifiedAt", Instant.now().toString());

            forms.add(form);
        });

        return forms;
    }
}
