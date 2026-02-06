package com.thisday.services;

import com.thisday.models.User;
import com.thisday.repositories.UserRepository;
import io.vertx.core.Future;
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

    public Future<Void> syncUser(User user) {
        log.debug("Syncing user [id={}]", user.id);

        return repo.upsert(user)
                .onFailure(cause -> log.error(
                        "Failed to sync user [id={}]",
                        user.id,
                        cause
                ))
                .onSuccess(v -> log.debug("User synced successfully [id={}]", user.id));
    }
}
