import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it.each([
  [
    "http://localhost:5173/",
    "http://127.0.0.1:5173",
    true,
    "http://127.0.0.1:5173",
  ],
  [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    true,
    "http://localhost:5173",
  ],
  [
    "http://localhost:5173",
    "http://localhost:5173",
    true,
    "http://localhost:5173",
  ],
  ["http://localhost:5173", "http://[::1]:5173", true, "http://[::1]:5173"],
  [
    "http://localhost:5173/backend/",
    "http://127.0.0.1:5173",
    true,
    "http://127.0.0.1:5173/backend",
  ],
  [
    "http://localhost:3000/",
    "http://127.0.0.1:5173",
    true,
    "http://localhost:3000",
  ],
  [
    "https://localhost:5173",
    "http://127.0.0.1:5173",
    true,
    "https://localhost:5173",
  ],
  [
    "http://localhost:5173",
    "http://192.168.0.164:5173",
    true,
    "http://192.168.0.164:5173",
  ],
  [
    "https://api.example.test/",
    "http://localhost:5173",
    true,
    "https://api.example.test",
  ],
  [
    "http://localhost:5173/",
    "http://127.0.0.1:5173",
    false,
    "http://localhost:5173",
  ],
])(
  "resolves API %s on page %s (dev=%s)",
  async (configured, origin, dev, expected) => {
    vi.stubEnv("VITE_API_URL", configured);
    vi.stubEnv("DEV", dev);
    vi.stubGlobal("window", { location: { origin } });
    const { API_URL } = await import("./api-config");
    expect(API_URL).toBe(expected);
  },
);
