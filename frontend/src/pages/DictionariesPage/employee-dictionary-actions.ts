import type { Dispatch, SetStateAction } from "react";
import {
  createAdminEmployee,
  setAdminEmployeeStatus,
  updateAdminEmployee,
  type AdminEmployee,
  type EmployeePayload,
} from "../../shared/api/users-admin-api";
import type { EmployeeDictionaryFormState } from "./dictionaries-page-types";

type EmployeeDictionaryActionsParams = {
  employeeForm: EmployeeDictionaryFormState;
  loadData: () => Promise<void>;
  runSavingAction: (action: () => Promise<void>) => Promise<void>;
  setEmployeeForm: Dispatch<SetStateAction<EmployeeDictionaryFormState>>;
  setMessage: (message: string | null) => void;
};

export function createEmployeeDictionaryActions({
  employeeForm,
  loadData,
  runSavingAction,
  setEmployeeForm,
  setMessage,
}: EmployeeDictionaryActionsParams) {
  const saveEmployee = async (payload: EmployeePayload) => {
    await runSavingAction(async () => {
      if (employeeForm === "new") {
        await createAdminEmployee(payload);
        setMessage("Сотрудник добавлен");
      } else if (employeeForm) {
        await updateAdminEmployee(employeeForm.id, payload);
        setMessage("Сотрудник обновлён");
      }

      setEmployeeForm(null);
      await loadData();
    });
  };

  const toggleEmployeeStatus = async (employee: AdminEmployee) => {
    const shouldDisable = employee.isActive;

    if (shouldDisable && employee.isLinkedToCurrentUser) {
      return;
    }

    if (
      shouldDisable &&
      employee.activeAccountCount > 0 &&
      !window.confirm(
        "Сотрудник будет отключён. Все связанные активные учётные записи пользователей также будут отключены.",
      )
    ) {
      return;
    }

    await runSavingAction(async () => {
      await setAdminEmployeeStatus(employee.id, !employee.isActive);
      setMessage(
        employee.isActive ? "Сотрудник отключён" : "Сотрудник включён",
      );
      await loadData();
    });
  };

  return {
    saveEmployee,
    toggleEmployeeStatus,
  };
}
