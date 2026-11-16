import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { warehouseReservationsApi as api } from "../../shared/api/warehouse-reservations-api";
import { useReservationOperation } from "./useReservationOperation";
import { row, order } from "./reservation-modal-test-utils";
vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: {
    reserve: vi.fn(),
    decrease: vi.fn(),
    increaseDemand: vi.fn(),
    reduceCoverage: vi.fn(),
    restoreCoverage: vi.fn(),
    move: vi.fn(),
  },
}));
const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});
afterEach(cleanup);
it("increases demand and assigns free stock in one request", async () => {
  const { result } = renderHook(() =>
    useReservationOperation(
      { kind: "demand", reservation: row, canCover: true, locationId: "1" },
      order.id,
      vi.fn(),
    ),
  );
  act(() => {
    result.current.setDemand("12,125");
    result.current.setCover("3");
    result.current.setComment("Дополнительная потребность");
  });
  await act(() => result.current.submit(event));
  expect(api.increaseDemand).toHaveBeenCalledWith(row.id, {
    expectedQuantity: row.quantity,
    quantity: "12.125",
    allocation: { locationId: "1", quantity: "3" },
    comment: "Дополнительная потребность",
  });
});
it("creates or increases using the selected item and exact decimal string", async () => {
  const saved = vi.fn();
  const { result } = renderHook(() =>
    useReservationOperation({ kind: "reserve" }, order.id, saved),
  );
  act(() => {
    result.current.setItem({ ...row.item, comment: null });
    result.current.setLocationId("1");
    result.current.setQuantity("1,125");
  });
  await act(() => result.current.submit(event));
  expect(api.reserve).toHaveBeenCalledWith({
    orderId: order.id,
    itemId: "1",
    locationId: "1",
    quantity: "1.125",
    requestKey: expect.any(String),
    comment: "",
  });
  expect(saved).toHaveBeenCalledOnce();
});
it("recovers a demand-only creation after reopening and sends the same key", async () => {
  vi.mocked(api.reserve)
    .mockRejectedValueOnce(new TypeError("Ответ потерян"))
    .mockResolvedValueOnce(row);
  const saved = vi.fn();
  const open = () =>
    renderHook(() =>
      useReservationOperation({ kind: "reserve" }, order.id, saved, "admin"),
    );
  const first = open();
  act(() => {
    first.result.current.setItem({ ...row.item, comment: null });
    first.result.current.setQuantity("5");
  });
  await act(() => first.result.current.submit(event));
  const payload = vi.mocked(api.reserve).mock.calls[0][0];
  expect(payload).toMatchObject({
    quantity: "5",
    requestKey: expect.any(String),
  });
  expect(payload).not.toHaveProperty("locationId");
  first.unmount();
  const retry = open();
  expect(retry.result.current.pendingReserve).toEqual(payload);
  await act(() => retry.result.current.submit(event));
  expect(api.reserve).toHaveBeenLastCalledWith(payload);
  expect(retry.result.current.pendingReserve).toBeNull();
  expect(saved).toHaveBeenCalledOnce();
});
it("decreases several allocations and deficit with an exact preview", async () => {
  const { result } = renderHook(() =>
    useReservationOperation(
      { kind: "decrease", reservation: row },
      order.id,
      vi.fn(),
    ),
  );
  act(() => {
    result.current.setAllocations({ "1": "1,125" });
    result.current.setDeficitQuantity("2");
    result.current.setComment("Уменьшение потребности");
  });
  expect(result.current.decreasePreview).toBe("3,125");
  await act(() => result.current.submit(event));
  expect(api.decrease).toHaveBeenCalledWith(row.id, {
    allocations: [{ locationId: "1", quantity: "1.125" }],
    deficitQuantity: "2",
    comment: "Уменьшение потребности",
  });
});
it.each(["reduce", "restore"] as const)(
  "uses the existing %s coverage command",
  async (kind) => {
    const operation =
      kind === "reduce"
        ? ({ kind, reservation: row, locationId: "1" } as const)
        : ({ kind, reservation: row } as const);
    const { result } = renderHook(() =>
      useReservationOperation(operation, order.id, vi.fn()),
    );
    act(() => {
      result.current.setLocationId("2");
      result.current.setQuantity(kind === "reduce" ? "6.999" : "1.001");
      result.current.setComment("Причина");
    });
    await act(() => result.current.submit(event));
    expect(
      kind === "reduce" ? api.reduceCoverage : api.restoreCoverage,
    ).toHaveBeenCalledWith(row.id, {
      locationId: kind === "reduce" ? "1" : "2",
      quantity: "1.001",
      ...(kind === "reduce" ? { expectedQuantity: "8" } : {}),
      comment: "Причина",
    });
  },
);
it("does not resend a non-idempotent command after an uncertain response", async () => {
  vi.mocked(api.reduceCoverage).mockRejectedValue(new Error("Ответ потерян"));
  const { result } = renderHook(() =>
    useReservationOperation(
      { kind: "reduce", reservation: row, locationId: "1" },
      order.id,
      vi.fn(),
    ),
  );
  act(() => {
    result.current.setQuantity("1");
    result.current.setComment("Причина");
  });
  await act(() => result.current.submit(event));
  await act(() => result.current.submit(event));
  expect(api.reduceCoverage).toHaveBeenCalledTimes(1);
  expect(result.current.uncertain).toBe(true);
});
it("rejects excess precision, zero and amounts above coverage or deficit", () => {
  const { result } = renderHook(() =>
    useReservationOperation(
      { kind: "restore", reservation: row },
      order.id,
      vi.fn(),
    ),
  );
  act(() => {
    result.current.setLocationId("1");
    result.current.setComment("Причина");
  });
  for (const value of ["0", "1.0001", "3", "-1"]) {
    act(() => result.current.setQuantity(value));
    expect(result.current.valid).toBe(false);
  }
});

it("blocks concurrent submissions while a command is pending", async () => {
  let finish!: (value: typeof row) => void;
  vi.mocked(api.reduceCoverage).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = renderHook(() =>
    useReservationOperation(
      { kind: "reduce", reservation: row, locationId: "1" },
      order.id,
      vi.fn(),
    ),
  );
  act(() => {
    result.current.setQuantity("1");
    result.current.setComment("Причина");
  });
  let request!: Promise<void>;
  act(() => {
    request = result.current.submit(event);
  });
  await act(() => result.current.submit(event));
  expect(api.reduceCoverage).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(row);
    await request;
  });
});
