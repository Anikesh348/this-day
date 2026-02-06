package com.thisday.services;

import com.thisday.repositories.EntryReadRepository;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class EntryReadService {

    private static final Logger log =
            LoggerFactory.getLogger(EntryReadService.class);

    private final EntryReadRepository repository;

    public EntryReadService(Vertx vertx) {
        this.repository = new EntryReadRepository(vertx);
    }

    public Future<JsonArray> getEntriesForDay(
            String userId,
            int year,
            int month,
            int day
    ) {
        log.debug(
                "Service: getEntriesForDay user={} date={}-{}-{}",
                userId, year, month, day
        );

        return repository.findByExactDay(userId, year, month, day);
    }

    public Future<JsonArray> getSameDayPreviousMonths(
            String userId,
            int year,
            int month,
            int day
    ) {
        log.debug(
                "Service: getSameDayPreviousMonths user={} date={}-{}-{}",
                userId, year, month, day
        );

        return repository.findSameDayPreviousMonths(userId, year, month, day);
    }

    public Future<JsonArray> getSameDayPreviousYears(
            String userId,
            int year,
            int month,
            int day
    ) {
        log.debug(
                "Service: getSameDayPreviousYears user={} dayMonth={}-{}",
                userId, month, day
        );

        return repository.findSameDayBestEntriesPerYear(userId, year, month, day);
    }

    public Future<JsonArray> getTodaySummary(
            String userId,
            int year,
            int month,
            int day
    ) {
        log.debug(
                "Service: getTodaySummary user={} date={}-{}-{}",
                userId, year, month, day
        );

        return repository.findTodaySummary(userId, year, month, day);
    }

    public Future<JsonArray> getCalendarEntries(
            String userId,
            int year,
            int month
    ) {
        log.debug(
                "Service: getCalendarEntries user={} year={} month={}",
                userId, year, month
        );

        return repository.findCalendarEntries(userId, year, month);
    }
}
