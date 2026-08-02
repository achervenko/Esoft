import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPdfPreviewBlob } from "../../api/files-api";
import { usePdfPreview } from "./usePdfPreview";

vi.mock("../../api/files-api", () => ({
  fetchPdfPreviewBlob: vi.fn(),
}));

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

function HookProbe(props: {
  fileId: number | null;
  open: boolean;
  visibleId: number;
}) {
  const preview = usePdfPreview(props);

  return (
    <div>
      <span data-testid="error">{preview.error ?? ""}</span>
      <span data-testid="file-url">{preview.fileUrl ?? ""}</span>
      <span data-testid="loading">{String(preview.isLoading)}</span>
      <button onClick={preview.loadPreview} type="button">
        retry
      </button>
    </div>
  );
}

function getLastSignal() {
  const calls = vi.mocked(fetchPdfPreviewBlob).mock.calls;
  const options = calls[calls.length - 1]?.[1];

  return options?.signal;
}

describe("usePdfPreview", () => {
  beforeEach(() => {
    vi.mocked(fetchPdfPreviewBlob).mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:pdf-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts the current PDF request on cleanup", async () => {
    const request = deferredPromise<Blob>();
    vi.mocked(fetchPdfPreviewBlob).mockReturnValueOnce(request.promise);

    const { unmount } = render(
      <HookProbe fileId={10} open visibleId={20} />,
    );

    await waitFor(() => {
      expect(fetchPdfPreviewBlob).toHaveBeenCalledTimes(1);
    });

    const signal = getLastSignal();
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("aborts the previous PDF request and starts a new one on retry", async () => {
    const firstRequest = deferredPromise<Blob>();
    const secondRequest = deferredPromise<Blob>();
    vi.mocked(fetchPdfPreviewBlob)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    render(<HookProbe fileId={10} open visibleId={20} />);

    await waitFor(() => {
      expect(fetchPdfPreviewBlob).toHaveBeenCalledTimes(1);
    });

    const firstSignal = getLastSignal();

    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => {
      expect(fetchPdfPreviewBlob).toHaveBeenCalledTimes(2);
    });

    const secondSignal = getLastSignal();
    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal?.aborted).toBe(false);
  });

  it("does not show a user-facing error for AbortError", async () => {
    vi.mocked(fetchPdfPreviewBlob).mockRejectedValueOnce(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    render(<HookProbe fileId={10} open visibleId={20} />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(screen.getByTestId("file-url")).toHaveTextContent("");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("shows regular PDF loading errors", async () => {
    vi.mocked(fetchPdfPreviewBlob).mockRejectedValueOnce(
      new Error("Network failed"),
    );

    render(<HookProbe fileId={10} open visibleId={20} />);

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Network failed");
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("ignores stale PDF response after visibleId changes", async () => {
    const firstRequest = deferredPromise<Blob>();
    const secondRequest = deferredPromise<Blob>();
    vi.mocked(fetchPdfPreviewBlob)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { rerender } = render(
      <HookProbe fileId={10} open visibleId={20} />,
    );

    await waitFor(() => {
      expect(fetchPdfPreviewBlob).toHaveBeenCalledTimes(1);
    });

    rerender(<HookProbe fileId={10} open visibleId={21} />);

    await waitFor(() => {
      expect(fetchPdfPreviewBlob).toHaveBeenCalledTimes(2);
    });

    firstRequest.resolve(new Blob(["old"]));
    secondRequest.resolve(new Blob(["new"]));

    await waitFor(() => {
      expect(screen.getByTestId("file-url")).toHaveTextContent(
        "blob:pdf-preview",
      );
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
