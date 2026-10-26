import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as dictionaries from "../../shared/api/dictionaries-admin-api";
import * as users from "../../shared/api/users-admin-api";
import { useDictionariesAdminData } from "./useDictionariesAdminData";
import type { ActiveDictionariesTab } from "./dictionaries-page-types";

afterEach(() => vi.restoreAllMocks());

it("clears operation errors when switching tabs and does not restore them on return", async () => {
  mockRequests();
  const hook = renderHook(
    ({ tab }: { tab: ActiveDictionariesTab }) =>
      useDictionariesAdminData(tab, true),
    { initialProps: { tab: "manufacturers" } },
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  act(() => hook.result.current.setError("Не удалось сохранить производителя"));
  expect(hook.result.current.error).toBe("Не удалось сохранить производителя");
  hook.rerender({ tab: "countries" });
  expect(hook.result.current.error).toBeNull();
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  hook.rerender({ tab: "manufacturers" });
  expect(hook.result.current.error).toBeNull();
});

function mockRequests() {
  return {
    positions: vi.spyOn(users, "getAdminPositions").mockResolvedValue([]),
    employees: vi.spyOn(users, "getAdminEmployees").mockResolvedValue([]),
    manufacturers: vi
      .spyOn(dictionaries, "getDictionaryManufacturers")
      .mockResolvedValue([]),
    models: vi
      .spyOn(dictionaries, "getDictionaryEquipmentModels")
      .mockResolvedValue([]),
    countries: vi
      .spyOn(dictionaries, "getDictionaryCountries")
      .mockResolvedValue([]),
    objects: vi
      .spyOn(dictionaries, "getDictionaryObjects")
      .mockResolvedValue([]),
    locations: vi
      .spyOn(dictionaries, "getDictionaryLocations")
      .mockResolvedValue([]),
  };
}

it("loads only the active tab and reuses loaded references when returning", async () => {
  const requests = mockRequests();
  const hook = renderHook(
    ({ tab }: { tab: ActiveDictionariesTab }) =>
      useDictionariesAdminData(tab, true),
    { initialProps: { tab: "countries" } },
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(requests.countries).toHaveBeenCalledOnce();
  expect(requests.employees).not.toHaveBeenCalled();
  expect(requests.manufacturers).not.toHaveBeenCalled();
  hook.rerender({ tab: "employees" });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(requests.employees).toHaveBeenCalledOnce();
  expect(requests.positions).toHaveBeenCalledOnce();
  hook.rerender({ tab: "countries" });
  expect(requests.countries).toHaveBeenCalledOnce();
  await act(() => hook.result.current.loadData(["employees"]));
  expect(requests.employees).toHaveBeenCalledTimes(2);
  expect(requests.positions).toHaveBeenCalledOnce();
  expect(requests.countries).toHaveBeenCalledOnce();
});

it("keeps successful resources and limits a failed resource to its own tab", async () => {
  const requests = mockRequests();
  requests.manufacturers.mockRejectedValue(new Error("offline"));
  requests.models.mockResolvedValue([
    {
      id: 1,
      name: "Модель",
      manufacturerId: 2,
      manufacturer: { id: 2, name: "Производитель" },
    },
  ]);
  const hook = renderHook(
    ({ tab }: { tab: ActiveDictionariesTab }) =>
      useDictionariesAdminData(tab, true),
    { initialProps: { tab: "manufacturers" } },
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.error).toBeTruthy();
  expect(hook.result.current.models).toHaveLength(1);
  hook.rerender({ tab: "countries" });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.error).toBeNull();
  requests.manufacturers.mockResolvedValue([]);
  hook.rerender({ tab: "manufacturers" });
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.error).toBeNull());
  expect(requests.models).toHaveBeenCalledOnce();
});

it("ignores an older response after a newer refresh has completed", async () => {
  const requests = mockRequests();
  let finishOld!: (items: dictionaries.DictionaryCountry[]) => void;
  requests.countries.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  const hook = renderHook(() => useDictionariesAdminData("countries", true));
  requests.countries.mockResolvedValue([
    { id: 2, iso: "RU", name: "Новая версия" },
  ]);
  await act(() => hook.result.current.loadData(["countries"]));
  await act(async () =>
    finishOld([{ id: 1, iso: "RU", name: "Старая версия" }]),
  );
  expect(hook.result.current.countries[0].name).toBe("Новая версия");
});

it("does not fetch administrative dictionaries for a disabled role", () => {
  const requests = mockRequests();
  renderHook(() => useDictionariesAdminData("employees", false));
  for (const request of Object.values(requests))
    expect(request).not.toHaveBeenCalled();
});
