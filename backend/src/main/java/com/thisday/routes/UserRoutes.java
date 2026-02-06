package com.thisday.routes;

import com.thisday.auth.AuthHandler;
import com.thisday.models.User;
import com.thisday.services.UserService;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserRoutes {

    private static final Logger log =
            LoggerFactory.getLogger(UserRoutes.class);

    public static void mount(Router router,
                             AuthHandler auth,
                             UserService userService) {

        log.info("Mounting API routes");

        router.get("/api/login")
                .handler(auth)
                .handler(ctx -> {
                    log.debug("Handling /api/me request");

                    JsonObject claims = ctx.get("authUser");
                    User user = User.fromJwt(claims);

                    log.debug("Syncing user from /api/me [id={}]", user.id);
                    userService.syncUser(user)
                            .onFailure(err -> log.error("Failed to sync user [id={}]", user.id, err));

                    ctx.json(user.toJson());
                });
    }
}
