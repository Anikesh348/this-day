package com.thisday.services;

import com.thisday.repositories.EntryReadRepository;
import io.vertx.core.AsyncResult;
import io.vertx.core.Handler;
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

    public void getEntriesForDay(
            String userId,
            int year,
            int month,
            int day,
            Handler<AsyncResult<JsonArray>> handler
    ) {
        log.debug(
                "Service: getEntriesForDay user={} date={}-{}-{}",
                userId, year, month, day
        );

        repository.findByExactDay(userId, year, month, day)
                .onComplete(handler);
    }

    public void getSameDayPreviousMonths(
            String userId,
            int year,
            int month,
            int day,
            Handler<AsyncResult<JsonArray>> handler
    ) {
        log.debug(
                "Service: getSameDayPreviousMonths user={} date={}-{}-{}",
                userId, year, month, day
        );

        repository.findSameDayPreviousMonths(userId, year, month, day)
                .onComplete(handler);
    }

    public void getSameDayPreviousYears(
            String userId,
            int month,
            int day,
            Handler<AsyncResult<JsonArray>> handler
    ) {
        log.debug(
                "Service: getSameDayPreviousYears user={} dayMonth={}-{}",
                userId, month, day
        );

        repository.findSameDayPreviousYears(userId, month, day)
                .onComplete(handler);
    }

    public void getCalendarEntries(
            String userId,
            int year,
            int month,
            Handler<AsyncResult<JsonArray>> handler
    ) {
        log.debug(
                "Service: getCalendarEntries user={} year={} month={}",
                userId, year, month
        );

        repository.findCalendarEntries(userId, year, month)
                .onComplete(handler);
    }
}
