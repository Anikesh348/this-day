import { Platform } from "react-native";
import api from "./api";

export type EntryFile = {
  uri: string;
  name: string;
  type: string;
  clientMediaId?: string;
  webFile?: Blob | null;
};

type UploadProgressCallback = (uploaded: number, total: number) => void;
const MAX_UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_BACKOFF_MS = 700;
const RETRIABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableUploadError(error: unknown) {
  const maybeError = error as {
    code?: string;
    response?: { status?: number };
  };

  const code = maybeError?.code;
  if (code === "ECONNABORTED" || code === "ERR_NETWORK") {
    return true;
  }

  const status = maybeError?.response?.status;
  if (typeof status === "number") {
    return RETRIABLE_HTTP_STATUSES.has(status);
  }

  // No response usually means transient connection issues.
  return true;
}

async function appendFile(form: FormData, file: EntryFile) {
  if (Platform.OS === "web") {
    if (typeof Blob !== "undefined" && file.webFile instanceof Blob) {
      form.append("file", file.webFile, file.name);
      return;
    }

    const res = await fetch(file.uri, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to read media for upload (${res.status})`);
    }
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
  if (file.clientMediaId) {
    form.append("clientMediaId", file.clientMediaId);
  }
  await appendFile(form, file);
  await api.post(`/api/entries/${entryId}/media`, form);
}

async function uploadSingleMediaWithRetry(entryId: string, file: EntryFile) {
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      await uploadSingleMedia(entryId, file);
      return;
    } catch (error) {
      if (attempt === MAX_UPLOAD_ATTEMPTS || !isRetriableUploadError(error)) {
        throw error;
      }

      const delayMs = UPLOAD_RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }
}

async function finalizeEntryUploadSession(entryId: string) {
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      await api.post(`/api/entries/${entryId}/finalize`);
      return;
    } catch (error) {
      if (attempt === MAX_UPLOAD_ATTEMPTS || !isRetriableUploadError(error)) {
        throw error;
      }

      const delayMs = UPLOAD_RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }
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
    await uploadSingleMediaWithRetry(entryId, file);
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

  return api.post(`/api/entries/${entryId}/update`, form);
}

export function deleteEntry(entryId: string) {
  return api.delete(`/api/entries/${entryId}`);
}
