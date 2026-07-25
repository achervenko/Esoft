export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, "");
}
