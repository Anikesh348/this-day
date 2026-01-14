package com.thisday.immich;

import com.thisday.config.AppConfig;
import io.vertx.core.*;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.client.*;
import io.vertx.ext.web.codec.BodyCodec;
import io.vertx.ext.web.multipart.MultipartForm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ImmichClient {

    private static final Logger log = LoggerFactory.getLogger(ImmichClient.class);

    private final WebClient client;
    private final String baseUrl;
    private final String apiKey;

    public ImmichClient(Vertx vertx) {
        this.client = WebClient.create(vertx);
        this.baseUrl = AppConfig.IMMICH_BASE_URL;
        this.apiKey = AppConfig.IMMICH_API_KEY;

        log.info("ImmichClient initialized [baseUrl={}]", baseUrl);
    }

    /*
     * ============================================================
     * UPLOAD
     * ============================================================
     */
    public void uploadAsset(
            MultipartForm form,
            Handler<AsyncResult<String>> handler) {

        String url = baseUrl + "/api/assets";
        long startTime = System.currentTimeMillis();

        client.postAbs(url)
                .putHeader("x-api-key", apiKey)
                .sendMultipartForm(form, ar -> {

                    long duration = System.currentTimeMillis() - startTime;

                    if (ar.failed()) {
                        log.error("Immich upload failed after {}ms", duration, ar.cause());
                        handler.handle(Future.failedFuture(ar.cause()));
                        return;
                    }

                    HttpResponse<Buffer> response = ar.result();

                    if (response.statusCode() < 200 || response.statusCode() >= 300) {
                        handler.handle(Future.failedFuture(
                                "Immich upload failed: " + response.statusCode() + " " + response.bodyAsString()));
                        return;
                    }

                    try {
                        String assetId = response.bodyAsJsonObject().getString("id");
                        log.info("Immich upload success assetId={} duration={}ms", assetId, duration);
                        handler.handle(Future.succeededFuture(assetId));
                    } catch (Exception e) {
                        handler.handle(Future.failedFuture(e));
                    }
                });
    }

    public void streamAsset(
            RoutingContext ctx,
            String assetId,
            String type) {
        HttpServerRequest request = ctx.request();
        HttpServerResponse response = ctx.response();

        String endpoint = "thumbnail".equalsIgnoreCase(type)
                ? "/api/assets/" + assetId + "/thumbnail"
                : "/api/assets/" + assetId + "/original";

        String url = baseUrl + endpoint;

        log.info("Streaming Immich asset assetId={} type={}", assetId, type);

        HttpRequest<Buffer> immichReq = client
                .getAbs(url)
                .putHeader("x-api-key", apiKey);

        // ✅ Forward Range header (CRITICAL for video)
        String range = request.getHeader("Range");
        if (range != null) {
            immichReq.putHeader("Range", range);
        }

        immichReq.send(ar -> {
            if (ar.failed()) {
                log.error("Immich stream request failed", ar.cause());
                if (!response.ended()) {
                    response.setStatusCode(502).end();
                }
                return;
            }

            HttpResponse<Buffer> immichResp = ar.result();

            // ✅ SET STATUS + HEADERS FIRST
            response.setStatusCode(immichResp.statusCode());

            copyHeader(immichResp, response, "Content-Type");
            copyHeader(immichResp, response, "Content-Length");
            copyHeader(immichResp, response, "Content-Range");

            response.putHeader("Accept-Ranges", "bytes");

            if ("thumbnail".equalsIgnoreCase(type)) {
                response.putHeader("Cache-Control", "no-store");
            } else {
                response.putHeader("Cache-Control", "public, max-age=31536000, immutable");
            }

            // ✅ STREAM BODY SAFELY (no buffering, no head issues)
            response.write(immichResp.body());
            response.end();
        });
    }

    private void copyHeader(HttpResponse<?> from, HttpServerResponse to, String name) {
        String value = from.getHeader(name);
        if (value != null) {
            to.putHeader(name, value);
        }
    }
}
