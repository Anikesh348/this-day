package com.thisday.routes;

import com.thisday.auth.AuthHandler;
import com.thisday.services.MediaService;
import io.vertx.ext.web.Router;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MediaRoutes {

    private static final Logger log =
            LoggerFactory.getLogger(MediaRoutes.class);

    public static void mount(
            Router router,
            AuthHandler authHandler,
            MediaService mediaService
    ) {

        // GET Immich asset (thumbnail or full)
        router.get("/api/media/immich/:assetId")
                .handler(authHandler)
                .handler(ctx -> {

                    String assetId = ctx.pathParam("assetId");
                    String type = ctx.request().getParam("type"); // thumbnail | full

                    if (type == null) {
                        type = "thumbnail";
                    }

                    log.info(
                            "Fetching Immich asset assetId={} type={}",
                            assetId, type
                    );

                    mediaService.streamImmichAsset(
                            assetId,
                            type,
                            ctx
                    );
                });
    }
}
