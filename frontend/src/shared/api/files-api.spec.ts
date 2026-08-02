import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "./api-error";
import { fetchPdfPreviewBlob } from "./files-api";
import { subscribeSessionExpired } from "./session-expired";

function createJsonResponse(status: number, body = { message: "Request failed" }) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("files-api PDF preview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("passes AbortSignal to PDF preview fetch", async () => {
    const signal = new AbortController().signal;
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPdfPreviewBlob(
        { fileId: 10, visibleId: 20 },
        { signal },
      ),
    ).resolves.toBeInstanceOf(Blob);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/equipment/20/files/10/preview"),
      expect.objectContaining({
        credentials: "include",
        signal,
      }),
    );
  });

  it("emits session-expired for 401 PDF preview responses", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(401, { message: "Unauthorized" }));

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        fetchPdfPreviewBlob({ fileId: 10, visibleId: 20 }),
      ).rejects.toBeInstanceOf(ApiRequestError);

      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});
