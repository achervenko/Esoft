import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEquipmentEditPage } from "./useEquipmentEditPage";
import { initialEquipmentCreateFormState } from "../../modules/equipment-create-form/model/equipment-create-form.types";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  options: vi.fn(),
  card: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("../../shared/api/equipment/equipment.api", () => ({
  updateEquipment: mocks.update,
  getEquipmentCreateOptions: mocks.options,
  getEquipmentCard: mocks.card,
}));
vi.mock("../../shared/ui/notifications", () => ({
  useNotifications: () => ({
    notifySuccess: mocks.success,
    notifyError: mocks.error,
    notifyWarning: mocks.warning,
  }),
}));
vi.mock(
  "../../modules/equipment-create-form/model/equipment-create-form.mapper",
  () => ({
    toEquipmentCreatePayload: () => ({ name: "Equipment" }),
    toEquipmentFormState: () => initialEquipmentCreateFormState,
  }),
);
vi.mock(
  "../../modules/equipment-create-form/model/equipment-create-form.validation",
  () => ({
    validateEquipmentCreateForm: mocks.validate,
    getEquipmentFieldErrorsFromMessage: () => ({}),
  }),
);
const event = {
  preventDefault: vi.fn(),
} as unknown as FormEvent<HTMLFormElement>;
function deferred() {
  let resolve!: (value: { visibleId: number }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ visibleId: number }>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function mount() {
  return renderHook(
    ({ id }) =>
      useEquipmentEditPage({
        initialTab: "details",
        returnTo: "#/equipment",
        userPermissions: ["equipment.edit"],
        visibleId: id,
      }),
    { initialProps: { id: 1 } },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.options.mockResolvedValue({});
  mocks.card.mockResolvedValue({});
  mocks.validate.mockReturnValue({ fieldErrors: {}, formError: null });
});
afterEach(cleanup);

it.each([false, true])(
  "rejects duplicate submits and unlocks only after failure: %s",
  async (fails) => {
    const pending = deferred();
    mocks.update.mockReturnValue(pending.promise);
    const { result } = mount();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let first!: Promise<void>;
    act(() => {
      first = result.current.handleSubmit(event);
      void result.current.handleSubmit(event);
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(true);
    await act(async () => {
      if (fails) pending.reject(new Error("Failed"));
      else pending.resolve({ visibleId: 1 });
      await first;
    });
    const next = deferred();
    mocks.update.mockReturnValue(next.promise);
    act(() => {
      void result.current.handleSubmit(event);
    });
    expect(mocks.update).toHaveBeenCalledTimes(fails ? 2 : 1);
    expect(result.current.isSubmitting).toBe(true);
  },
);

it("does not lock submission after validation fails", async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  mocks.validate.mockReturnValueOnce({ fieldErrors: {}, formError: "Invalid" });
  await act(async () => {
    await result.current.handleSubmit(event);
  });
  expect(mocks.update).not.toHaveBeenCalled();
  mocks.update.mockReturnValue(deferred().promise);
  act(() => {
    void result.current.handleSubmit(event);
  });
  expect(mocks.update).toHaveBeenCalledTimes(1);
});

it("resets the lock on equipment change and ignores stale requests even after returning to the same ID", async () => {
  const old = deferred();
  mocks.update.mockReturnValue(old.promise);
  const { result, rerender } = mount();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  let first!: Promise<void>;
  act(() => {
    first = result.current.handleSubmit(event);
  });
  rerender({ id: 2 });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.isSubmitting).toBe(false);
  rerender({ id: 1 });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  mocks.update.mockReturnValue(deferred().promise);
  act(() => {
    void result.current.handleSubmit(event);
  });
  expect(mocks.update).toHaveBeenCalledTimes(2);
  await act(async () => {
    old.reject(new Error("Stale failure"));
    await first;
  });
  expect(result.current.isSubmitting).toBe(true);
  expect(mocks.error).not.toHaveBeenCalled();
  act(() => {
    void result.current.handleSubmit(event);
  });
  expect(mocks.update).toHaveBeenCalledTimes(2);
});
