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
  setMessage: Dispatch<SetStateAction<string | null>>;
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
        setMessage("Сотрудник добавлен.");
      } else if (employeeForm) {
        await updateAdminEmployee(employeeForm.id, payload);
        setMessage("Сотрудник обновлён.");
      }

      setEmployeeForm(null);
      await loadData();
    });
  };

  const toggleEmployeeStatus = async (employee: AdminEmployee) => {
    await runSavingAction(async () => {
      await setAdminEmployeeStatus(employee.id, !employee.isActive);
      setMessage(
        employee.isActive ? "Сотрудник отключён." : "Сотрудник включён.",
      );
      await loadData();
    });
  };

  return {
    saveEmployee,
    toggleEmployeeStatus,
  };
}
