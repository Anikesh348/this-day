package com.thisday.models;

import com.thisday.enums.Role;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

public class User {

    private static final Logger log =
            LoggerFactory.getLogger(User.class);

    public String id;
    public String email;
    public String firstName;
    public String lastName;
    public String name;
    public String avatarUrl;
    public Role role;

    public Instant createdAt;
    public Instant updatedAt;

    public JsonObject toJson() {
        log.debug("Serializing User to JsonObject [id={}]", id);

        JsonObject json = new JsonObject()
                .put("_id", id)
                .put("email", email)
                .put("firstName", firstName)
                .put("lastName", lastName)
                .put("name", name)
                .put("avatarUrl", avatarUrl)
                .put("role", role.name())
                .put("updatedAt", updatedAt.toString());

        if (createdAt != null) {
            json.put("createdAt", createdAt.toString());
        }

        return json;
    }

    public static User fromJwt(JsonObject claims) {
        Instant now = Instant.now();

        User u = new User();
        u.id = claims.getString("sub");
        u.email = claims.getString("email");

        u.firstName = claims.getString("first_name");
        u.lastName = claims.getString("last_name");

        if (u.firstName != null && u.lastName != null) {
            u.name = u.firstName + " " + u.lastName;
        } else {
            u.name = u.email;
        }

        u.avatarUrl = claims.getString("profile_image_url");
        u.role = Role.fromClaim(claims.getString("role"));

        u.createdAt = now;
        u.updatedAt = now;

        log.debug(
                "User created from JWT claims [id={}, email={}, role={}]",
                u.id,
                u.email,
                u.role
        );

        return u;
    }
}
