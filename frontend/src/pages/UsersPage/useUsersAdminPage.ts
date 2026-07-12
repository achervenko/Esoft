import { useEffect, useState } from "react";
import {
  createAdminEmployee,
  createAdminUserAccount,
  deleteAdminEmployee,
  getAdminEmployees,
  getAdminRoles,
  getAdminUserAccounts,
  setAdminUserPassword,
  setAdminUserStatus,
  updateAdminEmployee,
  updateAdminUserAccount,
  type AdminEmployee,
  type AdminRoleOption,
  type AdminUserAccount,
  type EmployeePayload,
  type UserAccountPayload,
} from "../../shared/api/users-admin-api";
import { getUsersAdminErrorMessage } from "./users-admin-error-messages";

export type ActiveUsersTab = "employees" | "accounts";

export type EmployeeFormState = AdminEmployee | "new" | null;
export type UserFormState = AdminUserAccount | "new" | null;

type UseUsersAdminPageParams = {
  userRole: string | null;
};

export function useUsersAdminPage({ userRole }: UseUsersAdminPageParams) {
  const [activeTab, setActiveTab] = useState<ActiveUsersTab>("employees");
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [roles, setRoles] = useState<AdminRoleOption[]>([]);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(null);
  const [userForm, setUserForm] = useState<UserFormState>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = userRole === "admin";

  const loadData = () => {
    setIsLoading(true);
    setError(null);

    Promise.all([getAdminEmployees(), getAdminUserAccounts(), getAdminRoles()])
      .then(([employeeItems, userItems, roleItems]) => {
        setEmployees(employeeItems);
        setUsers(userItems);
        setRoles(roleItems);
      })
      .catch((requestError) => setError(getUsersAdminErrorMessage(requestError)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
      return;
    }

    setIsLoading(false);
  }, [isAdmin]);

  const saveEmployee = async (payload: EmployeePayload) => {
    await runSavingAction(async () => {
      if (employeeForm === "new") {
        await createAdminEmployee(payload);
        setMessage("Сотрудник добавлен.");
      } else if (employeeForm) {
        await updateAdminEmployee(employeeForm.id, payload);
        setMessage("Сотрудник обновлён.");
      }

      setEmployeeForm(null);
      loadData();
    });
  };

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
        setMessage("Учётная запись обновлена.");
      }

      setUserForm(null);
      loadData();
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

  const toggleUserStatus = async (user: AdminUserAccount) => {
    setError(null);

    try {
      await setAdminUserStatus(user.id, !user.banned);
      setMessage(
        user.banned
          ? "Учётная запись включена."
          : "Учётная запись отключена.",
      );
      loadData();
    } catch (requestError) {
      setError(getUsersAdminErrorMessage(requestError));
    }
  };

  const removeEmployee = async (employee: AdminEmployee) => {
    const confirmed = window.confirm(
      `Удалить сотрудника «${employee.fullName}»?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await deleteAdminEmployee(employee.id);
      setMessage("Сотрудник удалён.");
      loadData();
    } catch (requestError) {
      setError(getUsersAdminErrorMessage(requestError));
    }
  };

  const runSavingAction = async (action: () => Promise<void>) => {
    setIsSaving(true);
    setError(null);

    try {
      await action();
    } catch (requestError) {
      setError(getUsersAdminErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    activeTab,
    employees,
    employeeForm,
    error,
    isAdmin,
    isLoading,
    isSaving,
    message,
    passwordUser,
    removeEmployee,
    roles,
    saveEmployee,
    saveUser,
    setActiveTab,
    setEmployeeForm,
    setPassword,
    setPasswordUser,
    setUserForm,
    toggleUserStatus,
    userForm,
    users,
  };
}
