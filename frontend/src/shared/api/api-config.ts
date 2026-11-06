export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

function normalizeApiUrl(value: string) {
  const normalized = value.replace(/\/+$/, "");
  if (!import.meta.env.DEV) return normalized;

  const api = new URL(normalized);
  const page = new URL(window.location.origin);
  const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
  // The dev proxy must share the page origin so session cookies stay first-party.
  if (
    loopbackHosts.includes(api.hostname) &&
    api.port === page.port &&
    api.protocol === page.protocol
  ) {
    api.hostname = page.hostname;
    return api.toString().replace(/\/+$/, "");
  }
  return normalized;
}
