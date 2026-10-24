import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "./api-error";
import { downloadFileById, fetchPdfPreviewBlob, getFilePreviewUrl } from "./files-api";
import { subscribeSessionExpired } from "./session-expired";

function createJsonResponse(status: number, body = { message: "Request failed" }) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("files-api", () => {
  it.each([
    ["report%20one.pdf", "report one.pdf"],
    ["report%ZZ.pdf", "report%ZZ.pdf"],
    ["report%E0%A4.pdf", "report%E0%A4.pdf"],
  ])("downloads successfully with filename*=%s", async (encodedName, expectedName) => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:test-download");
      static revokeObjectURL = revoke;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("pdf", {
      headers: { "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}` },
    })));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await expect(downloadFileById({
      fileId: 1, visibleId: 1, fileName: "fallback.pdf",
    })).resolves.toBeUndefined();
    const downloadedLink = click.mock.contexts[0] as HTMLAnchorElement | undefined;
    expect(downloadedLink?.download).toBe(expectedName);
    expect(downloadedLink?.isConnected).toBe(false);
    expect(revoke).toHaveBeenCalledWith("blob:test-download");
  });

  it("changes the browser cache URL when a file ID is reused", () => {
    const params = { fileId: 1, visibleId: 1 };
    const oldUrl = getFilePreviewUrl(params, { size: "small", version: "2026-01-01T00:00:00Z" });
    const newUrl = getFilePreviewUrl(params, { size: "small", version: "2026-10-22T00:00:00Z" });
    expect(newUrl).not.toBe(oldUrl);
    expect(new URL(newUrl, "http://localhost").searchParams.get("v")).toBe("source-v1:2026-10-22T00:00:00Z");
  });
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
