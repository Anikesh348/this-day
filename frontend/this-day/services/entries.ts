import { Platform } from "react-native";
import api from "./api";

type EntryFile = {
  uri: string;
  name: string;
  type: string;
};

type UploadProgressCallback = (uploaded: number, total: number) => void;

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

async function appendFile(form: FormData, file: EntryFile) {
  if (Platform.OS === "web") {
    const res = await fetch(file.uri);
    const blob = await res.blob();
    form.append("file", blob, file.name);
    return;
  }

  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);
}

async function initEntryUploadSession(
  caption: string,
  expectedMediaCount: number,
  date?: string
) {
  const payload: { caption: string; expectedMediaCount: number; date?: string } =
    {
      caption,
      expectedMediaCount,
    };

  if (date) {
    payload.date = date;
  }

  const res = await api.post("/api/entries/init", payload);
  const entryId = res?.data?.entryId as string | undefined;
  if (!entryId) {
    throw new Error("Entry session initialization failed");
  }

  return entryId;
}

async function uploadSingleMedia(entryId: string, file: EntryFile) {
  const form = new FormData();
  await appendFile(form, file);
  await api.post(`/api/entries/${entryId}/media`, form);
}

async function finalizeEntryUploadSession(entryId: string) {
  await api.post(`/api/entries/${entryId}/finalize`);
}

async function createEntryWithSession(
  caption: string,
  files: EntryFile[],
  date?: string,
  onProgress?: UploadProgressCallback
) {
  const entryId = await initEntryUploadSession(caption, files.length, date);
  const total = files.length;
  let uploaded = 0;

  if (onProgress) {
    onProgress(uploaded, total);
  }

  for (const file of files) {
    await uploadSingleMedia(entryId, file);
    uploaded += 1;
    if (onProgress) {
      onProgress(uploaded, total);
    }
  }

  await finalizeEntryUploadSession(entryId);
}

export async function createEntry(
  caption: string,
  files: EntryFile[],
  onProgress?: UploadProgressCallback
) {
  return createEntryWithSession(caption, files, undefined, onProgress);
}

export async function createBackfilledEntry(
  date: string,
  caption: string,
  files: EntryFile[],
  onProgress?: UploadProgressCallback
) {
  return createEntryWithSession(caption, files, date, onProgress);
}

export async function updateEntry(
  entryId: string,
  caption: string,
  files: EntryFile[],
  removeAssetIds: string[] = []
) {
  const form = new FormData();
  form.append("caption", caption);
  form.append("removeAssetIds", JSON.stringify(removeAssetIds));

  for (const file of files) {
    await appendFile(form, file);
  }

  return api.put(`/api/entries/${entryId}`, form);
}

export function deleteEntry(entryId: string) {
  return api.delete(`/api/entries/${entryId}`);
}
