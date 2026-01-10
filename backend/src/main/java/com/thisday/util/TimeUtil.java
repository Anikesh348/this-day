package com.thisday.util;

import java.time.*;

public final class TimeUtil {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    public static final ZoneId UTC = ZoneId.of("UTC");

    private TimeUtil() {
    }

    /** Start of IST day converted to UTC Instant */
    public static Instant istStartToUtc(int year, int month, int day) {
        return LocalDate.of(year, month, day)
                .atStartOfDay(IST)
                .toInstant();
    }

    /** End of IST day converted to UTC Instant */
    public static Instant istEndToUtc(int year, int month, int day) {
        return LocalDate.of(year, month, day)
                .atTime(LocalTime.MAX)
                .atZone(IST)
                .toInstant();
    }

    /** Convert UTC Instant → IST date string */
    public static String utcInstantToIstDate(Instant instant) {
        return instant.atZone(IST).toLocalDate().toString();
    }
}
