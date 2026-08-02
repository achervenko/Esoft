import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "./api-error";
import { request } from "./api-client";
import { subscribeSessionExpired } from "./session-expired";

function mockJsonResponse(status: number, body = { message: "Request failed" }) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function subscribeSessionExpiredSpy() {
  const listener = vi.fn();
  const unsubscribe = subscribeSessionExpired(listener);

  return { listener, unsubscribe };
}

describe("api-client session-expired signal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("emits session-expired for authenticated 401 responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(401, { message: "Unauthorized" }));
    const sessionExpired = subscribeSessionExpiredSpy();

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(request("/api/protected")).rejects.toBeInstanceOf(
        ApiRequestError,
      );

      expect(sessionExpired.listener).toHaveBeenCalledTimes(1);
    } finally {
      sessionExpired.unsubscribe();
    }
  });

  it("does not emit session-expired for 403 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(mockJsonResponse(403));
    const sessionExpired = subscribeSessionExpiredSpy();

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(request("/api/protected")).rejects.toBeInstanceOf(
        ApiRequestError,
      );

      expect(sessionExpired.listener).not.toHaveBeenCalled();
    } finally {
      sessionExpired.unsubscribe();
    }
  });

  it("does not emit session-expired for 500 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(mockJsonResponse(500));
    const sessionExpired = subscribeSessionExpiredSpy();

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(request("/api/protected")).rejects.toBeInstanceOf(
        ApiRequestError,
      );

      expect(sessionExpired.listener).not.toHaveBeenCalled();
    } finally {
      sessionExpired.unsubscribe();
    }
  });

  it("keeps expected auth/public 401 local when unauthorized handling is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(mockJsonResponse(401));
    const sessionExpired = subscribeSessionExpiredSpy();

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        request("/api/setup/status", { handleUnauthorized: false }),
      ).rejects.toBeInstanceOf(ApiRequestError);

      expect(sessionExpired.listener).not.toHaveBeenCalled();
    } finally {
      sessionExpired.unsubscribe();
    }
  });
});
