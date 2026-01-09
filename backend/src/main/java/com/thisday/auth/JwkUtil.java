package com.thisday.auth;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.math.BigInteger;
import java.util.Base64;

public class JwkUtil {

    private static final Logger log =
            LoggerFactory.getLogger(JwkUtil.class);

    public static RSAPublicKey getPublicKey(JsonObject jwks, String kid) throws Exception {
        JsonArray keys = jwks.getJsonArray("keys");

        log.debug("Searching JWKS for matching key [kid={}]", kid);

        for (int i = 0; i < keys.size(); i++) {
            JsonObject key = keys.getJsonObject(i);
            String currentKid = key.getString("kid");

            if (kid.equals(currentKid)) {
                log.debug("Matching JWK found [kid={}]", kid);

                byte[] n = Base64.getUrlDecoder().decode(key.getString("n"));
                byte[] e = Base64.getUrlDecoder().decode(key.getString("e"));

                RSAPublicKey publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA")
                        .generatePublic(new RSAPublicKeySpec(
                                new BigInteger(1, n),
                                new BigInteger(1, e)
                        ));

                log.debug("RSA public key successfully constructed [kid={}]", kid);
                return publicKey;
            }
        }

        log.warn("No matching JWK found for kid={}", kid);
        throw new RuntimeException("Key not found");
    }
}
