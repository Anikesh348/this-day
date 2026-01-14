package com.thisday.services;

import com.thisday.immich.ImmichClient;
import io.vertx.core.Vertx;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MediaService {

    private static final Logger log =
            LoggerFactory.getLogger(MediaService.class);

    private final ImmichClient immichClient;

    public MediaService(Vertx vertx) {
        this.immichClient = new ImmichClient(vertx);
    }

    public void streamImmichAsset(
            String assetId,
            String type,
            RoutingContext ctx
    ) {
        immichClient.streamAsset(
                ctx,
                assetId,
                type
        );
    }
}
