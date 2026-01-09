package com.thisday.services;

import com.thisday.models.User;
import com.thisday.repositories.UserRepository;
import io.vertx.core.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserService {

    private static final Logger log =
            LoggerFactory.getLogger(UserService.class);

    private final UserRepository repo;

    public UserService(UserRepository repo) {
        this.repo = repo;
        log.info("UserService initialized");
    }

    public void syncUser(User user) {
        log.debug("Syncing user [id={}]", user.id);

        repo.upsert(user, ar -> {
            if (ar.failed()) {
                log.error(
                        "Failed to sync user [id={}]",
                        user.id,
                        ar.cause()
                );
            } else {
                log.debug("User synced successfully [id={}]", user.id);
            }
        });
    }
}
