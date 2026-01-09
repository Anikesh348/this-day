package com.thisday.enums;

public enum Role {
    ADMIN,
    USER;

    public static Role fromClaim(String value) {
        if (value == null || value.isBlank()) {
            return USER;
        }
        try {
            return Role.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return USER;
        }
    }
}
