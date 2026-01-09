package com.thisday.immich;

import com.thisday.config.AppConfig;
import io.vertx.core.*;
import io.vertx.ext.web.client.WebClient;
import io.vertx.ext.web.multipart.MultipartForm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.vertx.ext.web.codec.BodyCodec;
import io.vertx.core.http.HttpServerResponse;

public class ImmichClient {

    private static final Logger log =
            LoggerFactory.getLogger(ImmichClient.class);

    private final WebClient client;
    private final String baseUrl;
    private final String apiKey;

    public ImmichClient(Vertx vertx) {
        this.client = WebClient.create(vertx);
        this.baseUrl = AppConfig.IMMICH_BASE_URL;
        this.apiKey = AppConfig.IMMICH_API_KEY;

        log.info("ImmichClient initialized [baseUrl={}]", baseUrl);
    }

    public void uploadAsset(
            MultipartForm form,
            Handler<AsyncResult<String>> handler
    ) {
        log.debug("Uploading asset to Immich");
        String url = baseUrl + "/api/assets";
        log.info("Immich upload URL = {}", url);

        client.postAbs(url)
                .putHeader("x-api-key", apiKey)
                .sendMultipartForm(form, ar -> {

                    if (ar.failed()) {
                        log.error("Immich upload request failed", ar.cause());
                        handler.handle(Future.failedFuture(ar.cause()));
                        return;
                    }

                    var response = ar.result();
                    int status = response.statusCode();
                    String rawBody = response.bodyAsString();

                    log.info("Immich upload response status={}", status);
                    log.debug("Immich upload raw body={}", rawBody);

                    if (status < 200 || status >= 300) {
                        handler.handle(Future.failedFuture(
                                "Immich upload failed: " + status + " " + rawBody
                        ));
                        return;
                    }

                    try {
                        var jsonObject = response.bodyAsJsonObject();

                        String assetId = jsonObject
                                .getString("id");

                        handler.handle(Future.succeededFuture(assetId));

                    } catch (Exception e) {
                        log.error("Failed to parse Immich response", e);
                        handler.handle(Future.failedFuture(e));
                    }
                });
    }


    public void streamAsset(
            String assetId,
            String type,
            HttpServerResponse response
    ) {
        String endpoint;

        if ("full".equalsIgnoreCase(type)) {
            endpoint = "/api/assets/" + assetId + "/original";
        } else {
            endpoint = "/api/assets/" + assetId + "/thumbnail";
        }

        String url = baseUrl + endpoint;

        log.info("Streaming Immich asset url={} type={}", url, type);

        response
                .setChunked(true)
                .setStatusCode(200)
                .putHeader(
                        "Cache-Control",
                        "public, max-age=31536000, immutable"
                );

        client.getAbs(url)
                .putHeader("x-api-key", apiKey)
                .as(BodyCodec.pipe(response))
                .send(ar -> {
                    if (ar.failed()) {
                        log.error("Immich stream failed", ar.cause());
                        if (!response.ended()) {
                            response.setStatusCode(502).end();
                        }
                    }
                });
    }
}
