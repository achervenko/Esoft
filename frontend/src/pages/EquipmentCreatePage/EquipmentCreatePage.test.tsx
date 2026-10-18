import { permissionsForTest } from "../../test/permission-fixtures";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { EquipmentCreatePage } from "./EquipmentCreatePage";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  options: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("../../shared/api/equipment/equipment.api", () => ({
  createEquipment: mocks.create,
  getEquipmentCreateOptions: mocks.options,
}));
vi.mock("../../shared/ui/notifications", () => ({
  useNotifications: () => ({ notifySuccess: mocks.success, notifyError: mocks.error, notifyWarning: mocks.warning }),
}));
vi.mock("../../modules/equipment-create-form/model/equipment-create-form.validation", () => ({
  validateEquipmentCreateForm: () => ({ fieldErrors: {}, formError: null }),
  getEquipmentFieldErrorsFromMessage: () => ({}),
}));
vi.mock("../../modules/equipment-create-form/model/equipment-create-form.mapper", () => ({
  toEquipmentCreatePayload: () => ({ name: "Оборудование" }),
}));
vi.mock("../../modules/equipment-create-form/EquipmentCreateForm", () => ({
  EquipmentCreateForm: ({ onSubmit, isSubmitting }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; isSubmitting: boolean }) => (
    <form onSubmit={onSubmit}><button disabled={isSubmitting}>Создать</button></form>
  ),
}));
vi.mock("./equipment-create-redirect", () => ({
  scheduleEquipmentCreateRedirect: mocks.redirect,
  clearEquipmentCreateRedirectTimeout: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([false, true])("rejects duplicate submits and unlocks only after failure (failure=%s)", async (fails) => {
  mocks.options.mockResolvedValue({ nextVisibleId: 1 });
  let finish!: () => void;
  let reject!: (error: Error) => void;
  mocks.create.mockReturnValue(new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; }));
  render(<EquipmentCreatePage userPermissions={permissionsForTest("admin")} />);
  await screen.findByRole("button", { name: "Создать" });
  const form = document.querySelector("form")!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => { if (fails) reject(new Error("Failed")); else finish(); });
  mocks.create.mockReturnValue(new Promise<void>(() => {}));
  await act(async () => { fireEvent.submit(form); });
  expect(mocks.create).toHaveBeenCalledTimes(fails ? 2 : 1);
  expect(mocks.redirect).toHaveBeenCalledTimes(fails ? 0 : 1);
});
