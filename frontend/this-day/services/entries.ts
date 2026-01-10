// services/entries.ts

import { Platform } from "react-native";
import api from "./api";

export function getCalendar(year: number, month: number) {
  return api.get(`/api/entries/calendar?year=${year}&month=${month}`);
}

export function getDayEntries(year: number, month: number, day: number) {
  return api.get(`/api/entries/day?year=${year}&month=${month}&day=${day}`);
}

export function getSameDayPreviousMonths(
  year: number,
  month: number,
  day: number
) {
  return api.get(
    `/api/entries/same-day/previous-months?year=${year}&month=${month}&day=${day}`
  );
}

export function getSameDayPreviousYears(
  year: number,
  month: number,
  day: number
) {
  return api.get(
    `/api/entries/same-day/previous-years?year=${year}&month=${month}&day=${day}`
  );
}

export function getSameDaySummary(year: number, month: number, day: number) {
  return api.get(
    `/api/entries/day/summary?year=${year}&month=${month}&day=${day}`
  );
}

async function appendFile(
  form: FormData,
  file: { uri: string; name: string; type: string }
) {
  if (Platform.OS === "web") {
    // 🔑 WEB FIX: convert to Blob
    const res = await fetch(file.uri);
    const blob = await res.blob();
    form.append("file", blob, file.name);
  } else {
    // Native (iOS / Android)
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
  }
}

/**
 * Add entry for today
 */
export async function createEntry(
  caption: string,
  files: { uri: string; name: string; type: string }[]
) {
  const form = new FormData();
  form.append("caption", caption);

  for (const file of files) {
    await appendFile(form, file);
  }

  return api.post("/api/entries", form);
}

/**
 * Backfilled entry
 */
export async function createBackfilledEntry(
  date: string,
  caption: string,
  files: { uri: string; name: string; type: string }[]
) {
  const form = new FormData();
  form.append("date", date);
  form.append("caption", caption);

  for (const file of files) {
    await appendFile(form, file);
  }

  return api.post("/api/entries/backfill", form);
}

export function deleteEntry(entryId: string) {
  return api.delete(`/api/entries/${entryId}`);
}
