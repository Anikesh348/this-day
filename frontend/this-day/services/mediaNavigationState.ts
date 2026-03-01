export type MediaOpenHint = {
  assetId: string;
  date?: string;
  index: number;
  items?: Array<{
    id: string;
    occurrenceKey: string;
    caption?: string | null;
  }>;
  createdAtMs: number;
};

const HINT_MAX_AGE_MS = 2 * 60 * 1000;

let latestMediaOpenHint: MediaOpenHint | null = null;

export function setMediaOpenHint(hint: {
  assetId: string;
  date?: string;
  index: number;
  items?: Array<{
    id: string;
    occurrenceKey: string;
    caption?: string | null;
  }>;
}) {
  latestMediaOpenHint = {
    ...hint,
    createdAtMs: Date.now(),
  };
}

export function consumeMediaOpenHint(match: {
  assetId: string;
  date?: string;
}): MediaOpenHint | null {
  const hint = latestMediaOpenHint;
  latestMediaOpenHint = null;

  if (!hint) return null;
  if (Date.now() - hint.createdAtMs > HINT_MAX_AGE_MS) return null;
  if (hint.assetId !== match.assetId) return null;

  const normalizedHintDate = hint.date ?? null;
  const normalizedMatchDate = match.date ?? null;
  if (normalizedHintDate !== normalizedMatchDate) return null;

  return hint;
}
