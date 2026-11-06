import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../shared/api/api-error";
import { useReceiptSubmission } from "./useReceiptSubmission";

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const body = { quantity: "2", storageLocationId: "12" };
const mount = (actor = "keeper", operation = "place:1:2") =>
  renderHook(() => useReceiptSubmission<typeof body>(actor, operation));

it("survives unmount/reload and ignores changed input after a committed response is lost", async () => {
  const committed = new Map<string, number>();
  let stock = 0;
  const server = vi.fn(async (input: typeof body & { requestKey: string }) => {
    if (committed.has(input.requestKey))
      return committed.get(input.requestKey)!;
    stock += Number(input.quantity);
    committed.set(input.requestKey, stock);
    throw new TypeError("Failed to fetch");
  });
  const first = mount();
  await act(async () => {
    await expect(first.result.current.submit(body, server)).rejects.toThrow(
      "Failed to fetch",
    );
  });
  first.unmount();
  const reopened = mount();
  expect(reopened.result.current.pending?.body).toEqual(body);
  await act(async () => {
    expect(
      await reopened.result.current.submit({ ...body, quantity: "7" }, server),
    ).toBe(2);
  });
  expect(server.mock.calls[0]).toEqual(server.mock.calls[1]);
  expect(stock).toBe(2);
  expect(sessionStorage.length).toBe(0);
});

it("separates actors and receipt lines", async () => {
  const first = mount();
  await act(async () => {
    await expect(
      first.result.current.submit(body, async () => {
        throw Error("offline");
      }),
    ).rejects.toThrow();
  });
  expect(mount("another-user").result.current.pending).toBeNull();
  expect(mount("keeper", "place:1:3").result.current.pending).toBeNull();
  expect(mount().result.current.pending?.body).toEqual(body);
});

it("allows correcting a definitive first rejection", async () => {
  const hook = mount();
  await act(async () => {
    await expect(
      hook.result.current.submit(body, async () => {
        throw new ApiRequestError("Количество превышено", 409);
      }),
    ).rejects.toThrow();
  });
  expect(hook.result.current.pending).toBeNull();
  expect(sessionStorage.length).toBe(0);
});

it("does not forget an uncertain result when a later retry loses permissions", async () => {
  const hook = mount();
  await act(async () => {
    await expect(
      hook.result.current.submit(body, async () => {
        throw Error("offline");
      }),
    ).rejects.toThrow();
  });
  const key = hook.result.current.pending?.requestKey;
  await act(async () => {
    await expect(
      hook.result.current.submit(body, async () => {
        throw new ApiRequestError("Forbidden", 403);
      }),
    ).rejects.toThrow();
  });
  expect(hook.result.current.pending?.requestKey).toBe(key);
});

it.each(["unavailable", "corrupt"])(
  "never sends a mutation with %s recovery storage",
  async (mode) => {
    if (mode === "corrupt")
      sessionStorage.setItem(
        "warehouse.receipts.pending:keeper:place:1:2",
        "invalid-json",
      );
    else
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    const hook = mount();
    const server = vi.fn();
    await act(async () => {
      await expect(hook.result.current.submit(body, server)).rejects.toThrow();
    });
    expect(server).not.toHaveBeenCalled();
  },
);
