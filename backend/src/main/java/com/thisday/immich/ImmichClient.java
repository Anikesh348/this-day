package com.thisday.immich;

import com.thisday.config.AppConfig;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
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
    public Future<String> uploadAsset(
            MultipartForm form) {

        String url = baseUrl + "/api/assets";
        long startTime = System.currentTimeMillis();

        Promise<String> promise = Promise.promise();

        client.postAbs(url)
                .putHeader("x-api-key", apiKey)
                .sendMultipartForm(form, ar -> {

                    long duration = System.currentTimeMillis() - startTime;

                    if (ar.failed()) {
                        log.error("Immich upload failed after {}ms", duration, ar.cause());
                        promise.fail(ar.cause());
                        return;
                    }

                    HttpResponse<Buffer> response = ar.result();

                    if (response.statusCode() < 200 || response.statusCode() >= 300) {
                        promise.fail(
                                "Immich upload failed: " + response.statusCode() + " " + response.bodyAsString());
                        return;
                    }

                    try {
                        String assetId = response.bodyAsJsonObject().getString("id");
                        log.info("Immich upload success assetId={} duration={}ms", assetId, duration);
                        promise.complete(assetId);
                    } catch (Exception e) {
                        promise.fail(e);
                    }
                });
        return promise.future();
    }

    public void streamAsset(RoutingContext ctx, String assetId, String type) {
        HttpServerRequest request = ctx.request();
        HttpServerResponse response = ctx.response();

        // ✅ Handle HEAD requests (return headers only, no body)
        boolean isHeadRequest = "HEAD".equalsIgnoreCase(request.method().name());

        String endpoint = "thumbnail".equalsIgnoreCase(type)
                ? "/api/assets/" + assetId + "/thumbnail"
                : "/api/assets/" + assetId + "/original";
        String url = baseUrl + endpoint;

        log.info("Streaming Immich asset assetId={} type={} method={}", assetId, type, request.method());

        HttpRequest<Buffer> immichReq = client
                .getAbs(url)
                .putHeader("x-api-key", apiKey);

        // ✅ Use HEAD method if client sent HEAD
        if (isHeadRequest) {
            immichReq = client.headAbs(url).putHeader("x-api-key", apiKey);
        }

        String range = request.getHeader("Range");
        if (range != null && !isHeadRequest) {
            immichReq.putHeader("Range", range);
        }

        immichReq.send(ar -> {
            if (ar.failed()) {
                log.error("Immich request failed for assetId={}", assetId, ar.cause());
                if (!response.ended()) {
                    response.setStatusCode(502).end();
                }
                return;
            }

            HttpResponse<Buffer> immichResp = ar.result();
            int statusCode = immichResp.statusCode();

            if (statusCode != 200 && statusCode != 206) {
                log.error("Immich returned error status: {}", statusCode);
                if (!response.ended()) {
                    response.setStatusCode(statusCode).end();
                }
                return;
            }

            // Set status
            response.setStatusCode(statusCode);

            // Copy headers
            copyHeader(immichResp, response, "Content-Type");
            copyHeader(immichResp, response, "Content-Length");
            copyHeader(immichResp, response, "Content-Range");
            copyHeader(immichResp, response, "ETag");
            copyHeader(immichResp, response, "Last-Modified");

            String acceptRanges = immichResp.getHeader("Accept-Ranges");
            if (acceptRanges != null) {
                response.putHeader("Accept-Ranges", acceptRanges);
            } else {
                response.putHeader("Accept-Ranges", "bytes");
            }

            // ✅ CRITICAL: Force inline
            response.putHeader("Content-Disposition", "inline");

            // Cache headers
            if ("thumbnail".equalsIgnoreCase(type)) {
                response.putHeader("Cache-Control", "no-store");
            } else {
                response.putHeader("Cache-Control", "public, max-age=31536000, immutable");
            }

            // CORS
            response.putHeader("Access-Control-Allow-Origin", "*");
            response.putHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            response.putHeader("Access-Control-Allow-Headers", "Range, Content-Type");
            response.putHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

            // ✅ For HEAD requests, only send headers (no body)
            if (isHeadRequest) {
                response.end();
                return;
            }

            // Send body for GET requests
            Buffer body = immichResp.body();
            if (body != null && body.length() > 0) {
                response.end(body);
            } else {
                response.end();
            }
        });
    }

    private void copyHeader(HttpResponse<?> source, HttpServerResponse target, String headerName) {
        String value = source.getHeader(headerName);
        if (value != null) {
            target.putHeader(headerName, value);
        }
    }
}
