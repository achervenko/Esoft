import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/users-admin-api";
import { useUsersAdminPage } from "./useUsersAdminPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const account: api.AdminUserAccount = {
  id: "current",
  email: "admin@example.com",
  username: "admin",
  name: "Админ",
  role: "admin",
  roleLabel: "Админ",
  banned: false,
  employee: null,
  createdAt: "2026-01-01",
  lastLoginAt: null,
  displayUsername: "admin",
  photo: null,
};
const payload: api.UserAccountPayload = {
  email: "new@example.com",
  username: "new-admin",
  employeeId: 1,
  role: "admin",
};

it.each([false, true])("keeps saving locked through reload (reload failure=%s)", async (fails) => {
  vi.spyOn(api, "getAdminEmployees").mockResolvedValue([]);
  vi.spyOn(api, "getAdminRoles").mockResolvedValue([]);
  const users = vi.spyOn(api, "getAdminUserAccounts").mockResolvedValue([account]);
  const status = vi.spyOn(api, "setAdminUserStatus").mockResolvedValue({ ...account, banned: true });
  const { result } = renderHook(() => useUsersAdminPage({ userRole: "admin" }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  let finish!: (value: api.AdminUserAccount[]) => void;
  let reject!: (reason: Error) => void;
  users.mockReturnValueOnce(new Promise((resolve, fail) => { finish = resolve; reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.toggleUserStatus(account);
  });
  expect(result.current.isSaving).toBe(true);
  expect(result.current.isLoading).toBe(true);
  await act(async () => { await result.current.toggleUserStatus(account); });
  expect(status).toHaveBeenCalledTimes(1);
  await act(async () => {
    if (fails) reject(new Error("Reload failed"));
    else finish([{ ...account, banned: true }]);
    await pending;
  });
  expect(result.current.isSaving).toBe(false);
  expect(result.current.isLoading).toBe(false);
  if (fails) expect(result.current.error).toBeTruthy();
  else expect(result.current.users[0].banned).toBe(true);
});

it.each([false, true])("locks status changes until the request completes (banned=%s)", async (banned) => {
  vi.spyOn(api, "getAdminEmployees").mockResolvedValue([]);
  vi.spyOn(api, "getAdminRoles").mockResolvedValue([]);
  vi.spyOn(api, "getAdminUserAccounts").mockResolvedValue([account]);
  let finish!: (value: api.AdminUserAccount) => void;
  const status = vi.spyOn(api, "setAdminUserStatus").mockReturnValue(
    new Promise<api.AdminUserAccount>((resolve) => { finish = resolve; }),
  );
  const { result } = renderHook(() => useUsersAdminPage({ userRole: "admin" }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.toggleUserStatus({ ...account, banned });
    void result.current.toggleUserStatus({ ...account, banned });
  });
  expect(result.current.isSaving).toBe(true);
  expect(status).toHaveBeenCalledTimes(1);
  expect(status).toHaveBeenCalledWith(account.id, !banned);
  await act(async () => {
    finish({ ...account, banned: !banned });
    await pending;
  });
  expect(result.current.isSaving).toBe(false);
  expect(result.current.message).toBe(banned ? "Учётная запись включена." : "Учётная запись отключена.");
});

it.each(["current", "other"])(
  "refreshes the current profile only when updating %s",
  async (id) => {
    vi.spyOn(api, "getAdminEmployees").mockResolvedValue([]);
    vi.spyOn(api, "getAdminRoles").mockResolvedValue([]);
    vi.spyOn(api, "getAdminUserAccounts").mockResolvedValue([account]);
    vi.spyOn(api, "updateAdminUserAccount").mockResolvedValue({
      ...account,
      id,
    });
    vi.spyOn(api, "uploadAdminUserPhoto").mockResolvedValue({ ...account, id });
    vi.spyOn(api, "deleteAdminUserPhoto").mockResolvedValue({ ...account, id });
    const refresh = vi.fn();
    const hook = renderHook(() =>
      useUsersAdminPage({
        currentUserId: "current",
        onCurrentUserChanged: refresh,
        userRole: "admin",
      }),
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.setUserForm({ ...account, id }));
    await act(() => hook.result.current.saveUser(payload));
    act(() => hook.result.current.setPhotoUser({ ...account, id }));
    await act(() =>
      hook.result.current.saveUserPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      ),
    );
    act(() => hook.result.current.setPhotoUser({ ...account, id }));
    await act(() => hook.result.current.deleteUserPhoto());
    expect(refresh).toHaveBeenCalledTimes(id === "current" ? 3 : 0);
  },
);
