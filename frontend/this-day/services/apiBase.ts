export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://thisdayapi.hostingfrompurva.xyz"
).replace(/\/+$/, "");

export function apiUrl(path: string) {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
