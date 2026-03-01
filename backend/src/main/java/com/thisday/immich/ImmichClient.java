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

import java.util.ArrayList;
import java.util.List;

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
        String requestedType = type == null ? "thumbnail" : type.toLowerCase();
        String range = request.getHeader("Range");

        log.info("Streaming Immich asset assetId={} type={} method={}", assetId, type, request.method());

        List<String> endpoints = buildEndpointFallbacks(assetId, requestedType);
        sendWithFallback(endpoints, 0, isHeadRequest, range, ar -> {
            if (ar.failed()) {
                log.error("Immich request failed for assetId={} type={}", assetId, requestedType, ar.cause());
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

            // Asset IDs are immutable; aggressive caching improves perceived load speed.
            response.putHeader("Cache-Control", "public, max-age=31536000, immutable");

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

    private List<String> buildEndpointFallbacks(String assetId, String requestedType) {
        List<String> endpoints = new ArrayList<>();
        String thumbnail = "/api/assets/" + assetId + "/thumbnail?size=thumbnail";
        String preview = "/api/assets/" + assetId + "/thumbnail?size=preview";
        String original = "/api/assets/" + assetId + "/original";

        if ("thumbnail".equals(requestedType)) {
            endpoints.add(thumbnail);
            endpoints.add(preview);
            endpoints.add(original);
            return endpoints;
        }

        if ("preview".equals(requestedType)) {
            endpoints.add(preview);
            endpoints.add(thumbnail);
            endpoints.add(original);
            return endpoints;
        }

        // full/original request
        endpoints.add(original);
        endpoints.add(preview);
        endpoints.add(thumbnail);
        return endpoints;
    }

    private void sendWithFallback(
            List<String> endpoints,
            int index,
            boolean isHeadRequest,
            String range,
            io.vertx.core.Handler<io.vertx.core.AsyncResult<HttpResponse<Buffer>>> handler
    ) {
        if (index >= endpoints.size()) {
            handler.handle(io.vertx.core.Future.failedFuture("All Immich fallback endpoints failed"));
            return;
        }

        String endpoint = endpoints.get(index);
        String url = baseUrl + endpoint;

        HttpRequest<Buffer> req = isHeadRequest
                ? client.headAbs(url)
                : client.getAbs(url);

        req.putHeader("x-api-key", apiKey);

        if (!isHeadRequest && range != null && endpoint.endsWith("/original")) {
            req.putHeader("Range", range);
        }

        req.send(ar -> {
            if (ar.failed()) {
                log.warn("Immich request failed endpoint={} index={}", endpoint, index, ar.cause());
                sendWithFallback(endpoints, index + 1, isHeadRequest, range, handler);
                return;
            }

            HttpResponse<Buffer> resp = ar.result();
            int status = resp.statusCode();
            if (status == 200 || status == 206) {
                handler.handle(io.vertx.core.Future.succeededFuture(resp));
                return;
            }

            log.warn("Immich request non-success endpoint={} index={} status={}", endpoint, index, status);
            sendWithFallback(endpoints, index + 1, isHeadRequest, range, handler);
        });
    }

    private void copyHeader(HttpResponse<?> source, HttpServerResponse target, String headerName) {
        String value = source.getHeader(headerName);
        if (value != null) {
            target.putHeader(headerName, value);
        }
    }
}
