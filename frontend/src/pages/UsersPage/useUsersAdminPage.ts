import { useEffect, useRef, useState } from "react";
import { canManageUsers } from "../../shared/lib/roles";
import {
  createAdminUserAccount,
  deleteAdminUserPhoto,
  getAdminEmployees,
  getAdminRoles,
  getAdminUserAccounts,
  setAdminUserPassword,
  setAdminUserStatus,
  updateAdminUserAccount,
  uploadAdminUserPhoto,
  type AdminEmployee,
  type AdminRoleOption,
  type AdminUserAccount,
  type UserAccountPayload,
} from "../../shared/api/users-admin-api";
import { getUsersAdminErrorMessage } from "./users-admin-error-messages";

export type UserFormState = AdminUserAccount | "new" | null;

type UseUsersAdminPageParams = {
  currentUserId?: string | null;
  onCurrentUserChanged?: () => void;
  userPermissions: readonly string[] | null;
};

export function useUsersAdminPage({
  currentUserId,
  onCurrentUserChanged,
  userPermissions,
}: UseUsersAdminPageParams) {
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [roles, setRoles] = useState<AdminRoleOption[]>([]);
  const [userForm, setUserForm] = useState<UserFormState>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUserAccount | null>(
    null,
  );
  const [photoUser, setPhotoUser] = useState<AdminUserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const usersManageable = canManageUsers(userPermissions);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [employeeItems, userItems, roleItems] = await Promise.all([
        getAdminEmployees(), getAdminUserAccounts(), getAdminRoles(),
      ]);
      setEmployees(employeeItems);
      setUsers(userItems);
      setRoles(roleItems);
    } catch (requestError) {
      setMessage(null);
      setError(getUsersAdminErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (usersManageable) {
      void loadData();
      return;
    }

    setIsLoading(false);
  }, [usersManageable]);

  const saveUser = async (payload: UserAccountPayload) => {
    await runSavingAction(async () => {
      if (userForm === "new") {
        await createAdminUserAccount({
          ...payload,
          password: payload.password ?? "",
        });
        setMessage("Учётная запись создана.");
      } else if (userForm) {
        await updateAdminUserAccount(userForm.id, {
          email: payload.email,
          employeeId: payload.employeeId,
          role: payload.role,
          username: payload.username,
        });
        refreshCurrentUserIfNeeded(userForm.id);
        setMessage("Учётная запись обновлена.");
      }

      setUserForm(null);
      await loadData();
    });
  };

  const setPassword = async (password: string) => {
    if (!passwordUser) {
      return;
    }

    await runSavingAction(async () => {
      await setAdminUserPassword(passwordUser.id, password);
      setPasswordUser(null);
      setMessage("Пароль обновлён.");
    });
  };

  const saveUserPhoto = async (file: File) => {
    if (!photoUser) {
      return;
    }

    await runSavingAction(async () => {
      const updatedUser = await uploadAdminUserPhoto(photoUser.id, file);
      setPhotoUser(null);
      setMessage("Фото пользователя сохранено.");
      replaceUser(updatedUser);
      refreshCurrentUserIfNeeded(updatedUser.id);
    });
  };

  const deleteUserPhoto = async () => {
    if (!photoUser) {
      return;
    }

    await runSavingAction(async () => {
      const updatedUser = await deleteAdminUserPhoto(photoUser.id);
      setPhotoUser(null);
      setMessage("Фото пользователя удалено.");
      replaceUser(updatedUser);
      refreshCurrentUserIfNeeded(updatedUser.id);
    });
  };

  const toggleUserStatus = (user: AdminUserAccount) =>
    runSavingAction(async () => {
      await setAdminUserStatus(user.id, !user.banned);
      setMessage(
        user.banned ? "Учётная запись включена." : "Учётная запись отключена.",
      );
      await loadData();
    });

  const runSavingAction = async (action: () => Promise<void>) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await action();
    } catch (requestError) {
      setError(getUsersAdminErrorMessage(requestError));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const replaceUser = (updatedUser: AdminUserAccount) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  };

  const refreshCurrentUserIfNeeded = (userId: string) => {
    if (userId === currentUserId) {
      onCurrentUserChanged?.();
    }
  };

  return {
    deleteUserPhoto,
    employees,
    error,
    usersManageable,
    isLoading,
    isSaving,
    message,
    passwordUser,
    photoUser,
    roles,
    saveUser,
    saveUserPhoto,
    setPassword,
    setPasswordUser,
    setPhotoUser,
    setUserForm,
    toggleUserStatus,
    userForm,
    users,
  };
}
