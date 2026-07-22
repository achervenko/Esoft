import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../shared/api/api-error";
import { getEquipmentFiles } from "../../shared/api/equipment-files/equipment-files.api";
import { createEquipmentPhoto } from "./equipment-card.test-helpers";
import { useEquipmentPhotos } from "./use-equipment-photos";

vi.mock("../../shared/api/equipment-files/equipment-files.api", () => ({
  getEquipmentFiles: vi.fn(),
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

function HookProbe(props: { enabled: boolean; visibleId: number }) {
  const state = useEquipmentPhotos(props);

  return (
    <div>
      <span data-testid="loading">{String(state.isLoading)}</span>
      <span data-testid="error">{state.error ?? ""}</span>
      <span data-testid="count">{String(state.photos.length)}</span>
      <span data-testid="ids">{state.photos.map((photo) => photo.id).join(",")}</span>
    </div>
  );
}

describe("useEquipmentPhotos", () => {
  beforeEach(() => {
    vi.mocked(getEquipmentFiles).mockReset();
  });

  it("does not load photos when disabled", () => {
    render(<HookProbe enabled={false} visibleId={42} />);

    expect(getEquipmentFiles).not.toHaveBeenCalled();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("loads only equipment photos successfully", async () => {
    const request = deferredPromise([
      createEquipmentPhoto({ id: 1 }),
      createEquipmentPhoto({
        documentType: "passport",
        displayName: "Паспорт.pdf",
        id: 2,
      }),
    ]);

    vi.mocked(getEquipmentFiles).mockReturnValueOnce(request.promise);

    render(<HookProbe enabled visibleId={42} />);

    expect(getEquipmentFiles).toHaveBeenCalledWith(42);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    request.resolve([
      createEquipmentPhoto({ id: 1 }),
      createEquipmentPhoto({
        documentType: "passport",
        displayName: "Паспорт.pdf",
        id: 2,
      }),
    ]);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("ids")).toHaveTextContent("1");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("stores API error and clears stale photos for a new visibleId", async () => {
    vi.mocked(getEquipmentFiles)
      .mockResolvedValueOnce([createEquipmentPhoto({ id: 1 })])
      .mockRejectedValueOnce(new ApiRequestError("Ошибка загрузки", 500));

    const { rerender } = render(<HookProbe enabled visibleId={42} />);

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    rerender(<HookProbe enabled visibleId={43} />);

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Ошибка загрузки");
    });

    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("loads new photos when visibleId changes", async () => {
    vi.mocked(getEquipmentFiles)
      .mockResolvedValueOnce([createEquipmentPhoto({ id: 1 })])
      .mockResolvedValueOnce([createEquipmentPhoto({ id: 2 })]);

    const { rerender } = render(<HookProbe enabled visibleId={42} />);

    await waitFor(() => {
      expect(screen.getByTestId("ids")).toHaveTextContent("1");
    });

    rerender(<HookProbe enabled visibleId={43} />);

    expect(screen.getByTestId("count")).toHaveTextContent("0");

    await waitFor(() => {
      expect(screen.getByTestId("ids")).toHaveTextContent("2");
    });
  });

  it("requests photos again after reopening the details tab", async () => {
    vi.mocked(getEquipmentFiles)
      .mockResolvedValueOnce([createEquipmentPhoto({ id: 1 })])
      .mockResolvedValueOnce([createEquipmentPhoto({ id: 1 })]);

    const { rerender } = render(<HookProbe enabled visibleId={42} />);

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    rerender(<HookProbe enabled={false} visibleId={42} />);
    rerender(<HookProbe enabled visibleId={42} />);

    await waitFor(() => {
      expect(vi.mocked(getEquipmentFiles)).toHaveBeenCalledTimes(2);
    });
  });
});
