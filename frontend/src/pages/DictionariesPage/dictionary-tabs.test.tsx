import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { NotificationProvider } from "../../shared/ui/notifications";
import * as users from "../../shared/api/users-admin-api";
import { getAvailableDictionaryTabs } from "./dictionary-tabs";
import { useDictionariesAdminPage } from "./useDictionariesAdminPage";

const allPermissions = [
  "dictionaries.manage",
  "warehouse.storage-locations.read",
];
const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

beforeEach(() => {
  window.history.replaceState(null, "", "#/dictionaries");
  sessionStorage.clear();
  vi.spyOn(users, "getAdminEmployees").mockResolvedValue([]);
  vi.spyOn(users, "getAdminPositions").mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "#/dictionaries");
  sessionStorage.clear();
  vi.restoreAllMocks();
});

it("uses the addressed tab before storage and follows navigation without remount", () => {
  sessionStorage.setItem("esoft:dictionaries:tab", "storageLocations");
  window.history.replaceState(null, "", "#/dictionaries?tab=employees");
  const { result } = renderHook(
    () => useDictionariesAdminPage({ userPermissions: allPermissions }),
    { wrapper },
  );
  expect(result.current.activeTab).toBe("employees");
  act(() => {
    window.history.replaceState(
      null,
      "",
      "#/dictionaries?tab=storage-locations",
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(result.current.activeTab).toBe("storageLocations");
  act(() => result.current.setActiveTab("employees"));
  expect(window.location.hash).toBe("#/dictionaries?tab=employees");
});

it("does not grant access through an addressed tab", () => {
  window.history.replaceState(null, "", "#/dictionaries?tab=employees");
  const { result } = renderHook(
    () =>
      useDictionariesAdminPage({
        userPermissions: ["warehouse.storage-locations.read"],
      }),
    { wrapper },
  );
  expect(result.current.activeTab).toBe("storageLocations");
  expect(users.getAdminEmployees).not.toHaveBeenCalled();
});

it("keeps the fallback tab when permissions expand without remount", () => {
  window.history.replaceState(null, "", "#/dictionaries?tab=employees");
  const hook = renderHook(
    ({ permissions }: { permissions: string[] }) =>
      useDictionariesAdminPage({ userPermissions: permissions }),
    {
      wrapper,
      initialProps: { permissions: ["warehouse.storage-locations.read"] },
    },
  );
  expect(hook.result.current.activeTab).toBe("storageLocations");
  hook.rerender({ permissions: allPermissions });
  expect(hook.result.current.activeTab).toBe("storageLocations");
  expect(users.getAdminEmployees).not.toHaveBeenCalled();
  act(() => {
    window.history.replaceState(null, "", "#/dictionaries?tab=employees");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(hook.result.current.activeTab).toBe("employees");
});

it("keeps storage in the same selection and restores it after remount", async () => {
  const first = renderHook(
    () => useDictionariesAdminPage({ userPermissions: allPermissions }),
    { wrapper },
  );
  await waitFor(() => expect(first.result.current.isLoading).toBe(false));
  act(() => first.result.current.setActiveTab("storageLocations"));
  expect(first.result.current.activeTab).toBe("storageLocations");
  expect(sessionStorage.getItem("esoft:dictionaries:tab")).toBe(
    "storageLocations",
  );
  first.unmount();
  const second = renderHook(
    () => useDictionariesAdminPage({ userPermissions: allPermissions }),
    { wrapper },
  );
  expect(second.result.current.activeTab).toBe("storageLocations");
  expect(users.getAdminEmployees).toHaveBeenCalledOnce();
});

it("falls back to an allowed tab without fetching general dictionaries", () => {
  sessionStorage.setItem("esoft:dictionaries:tab", "employees");
  const permissions = ["warehouse.storage-locations.read"];
  const { result } = renderHook(
    () => useDictionariesAdminPage({ userPermissions: permissions }),
    { wrapper },
  );
  expect(result.current.activeTab).toBe("storageLocations");
  expect(result.current.availableTabs.map((tab) => tab.id)).toEqual([
    "storageLocations",
  ]);
  expect(users.getAdminEmployees).not.toHaveBeenCalled();
  expect(users.getAdminPositions).not.toHaveBeenCalled();
});

it("combines limited employee and storage access in one list", () => {
  expect(
    getAvailableDictionaryTabs([
      "ppe.employee-sizes.manage",
      "warehouse.storage-locations.read",
    ]).map((tab) => tab.id),
  ).toEqual(["employees", "storageLocations"]);
  expect(getAvailableDictionaryTabs([])).toEqual([]);
  expect(
    getAvailableDictionaryTabs(["dictionaries.manage"]).some(
      (tab) => tab.id === "storageLocations",
    ),
  ).toBe(false);
});
