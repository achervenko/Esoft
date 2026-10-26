import { permissionsForTest } from "../../test/permission-fixtures";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EquipmentPage } from "./EquipmentPage";
import { getEquipmentRegistry } from "../../shared/api/equipment/equipment.api";
vi.mock("../../shared/api/equipment/equipment.api", () => ({
  getEquipmentRegistry: vi.fn(),
}));
const notifyError = vi.hoisted(() => vi.fn());
vi.mock("../../shared/ui/notifications", () => ({
  useNotifications: () => ({ notifyError }),
}));
vi.mock("./EquipmentRegistryTable", () => ({
  EquipmentRegistryTable: ({
    onSortChange,
  }: {
    onSortChange: (sort: { key: string; direction: string }) => void;
  }) => (
    <button onClick={() => onSortChange({ key: "name", direction: "asc" })}>
      Сортировать название
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("fetches batches and aborts an outstanding batch when sorting changes", async () => {
  vi.mocked(getEquipmentRegistry).mockResolvedValue({
    items: [
      {
        id: 1,
      } as import("../../shared/api/equipment/equipment.types").EquipmentRegistryItem,
    ],
    total: 100000,
    page: 1,
    limit: 100,
  });
  render(<EquipmentPage userPermissions={permissionsForTest("admin")} />);
  await screen.findByRole("button", { name: "Сортировать название" });
  expect(getEquipmentRegistry).toHaveBeenCalledOnce();
  const firstSignal = vi.mocked(getEquipmentRegistry).mock.calls[0][1]!;
  vi.mocked(getEquipmentRegistry).mockImplementationOnce(
    () => new Promise(() => {}),
  );
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await waitFor(() =>
    expect(getEquipmentRegistry).toHaveBeenLastCalledWith(
      { page: 2, sort: "visibleId", direction: "asc" },
      expect.any(AbortSignal),
    ),
  );
  expect(firstSignal.aborted).toBe(false);
  const pendingSignal = vi.mocked(getEquipmentRegistry).mock.calls[1][1]!;
  fireEvent.click(
    await screen.findByRole("button", { name: "Сортировать название" }),
  );
  await waitFor(() =>
    expect(getEquipmentRegistry).toHaveBeenLastCalledWith(
      { page: 1, sort: "name", direction: "asc" },
      expect.any(AbortSignal),
    ),
  );
  expect(pendingSignal.aborted).toBe(true);
});
