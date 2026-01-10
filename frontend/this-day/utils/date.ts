/**
 * Converts a local calendar date (IST / device local)
 * into the correct UTC date parts for backend APIs.
 */
export function localDateToUTCParts(date: Date) {
  // Create date at LOCAL midnight
  const localMidnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  );

  // Convert to UTC
  return {
    year: localMidnight.getUTCFullYear(),
    month: localMidnight.getUTCMonth() + 1,
    day: localMidnight.getUTCDate(),
    utcDateString: localMidnight.toISOString().slice(0, 10),
  };
}

/**
 * Converts YYYY-MM-DD (local calendar selection)
 * into UTC date parts
 */
export function localDateStringToUTCParts(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateToUTCParts(new Date(y, m - 1, d));
}
