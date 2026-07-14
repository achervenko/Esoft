import type { Dispatch, SetStateAction } from "react";
import {
  createAdminEmployee,
  deleteAdminEmployee,
  updateAdminEmployee,
  type AdminEmployee,
  type EmployeePayload,
} from "../../shared/api/users-admin-api";
import type { EmployeeDictionaryFormState } from "./dictionaries-page-types";

type EmployeeDictionaryActionsParams = {
  employeeForm: EmployeeDictionaryFormState;
  loadData: () => void;
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
      loadData();
    });
  };

  const removeEmployee = async (employee: AdminEmployee) => {
    if (!window.confirm(`Удалить сотрудника «${employee.fullName}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteAdminEmployee(employee.id);
      setMessage("Сотрудник удалён.");
      loadData();
    });
  };

  return {
    removeEmployee,
    saveEmployee,
  };
}
