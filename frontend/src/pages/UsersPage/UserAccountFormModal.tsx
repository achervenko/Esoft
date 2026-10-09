import { useState } from "react";
import { isValidPassword, MAX_PASSWORD_LENGTH, PASSWORD_POLICY_MESSAGE } from "../../shared/lib/password-validation";
import type {
  AdminEmployee,
  AdminRoleOption,
  AdminUserAccount,
  UserAccountPayload,
} from "../../shared/api/users-admin-api";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { FormField } from "../../shared/ui/FormField";

type UserAccountFormModalProps = {
  employees: AdminEmployee[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: UserAccountPayload) => void;
  roles: AdminRoleOption[];
  user: AdminUserAccount | null;
};

export function UserAccountFormModal({
  employees,
  isSaving,
  onClose,
  onSubmit,
  roles,
  user,
}: UserAccountFormModalProps) {
  const [initialForm] = useState({
    email: user?.email ?? "",
    employeeId: user?.employee?.id ? String(user.employee.id) : "",
    password: "",
    role: String(user?.role ?? "operator"),
    username: user?.username ?? "",
  });
  const [form, setForm] = useState(initialForm);
  const comparable = (value: typeof form) =>
    JSON.stringify([
      value.email.trim().toLowerCase(),
      value.employeeId,
      value.password,
      value.role,
      value.username.trim().toLowerCase(),
    ]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const isCreateMode = !user;

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const employeeId = Number(form.employeeId);
    const selectedRole = roles.find((role) => role.value === form.role);

    if (isSaving) {
      return;
    }

    const nextErrors: typeof fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Укажите корректный email.";
    }

    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(form.username.trim())) {
      nextErrors.username = "Логин должен содержать 3–64 латинских символа, цифры, точку, дефис или нижнее подчёркивание.";
    }

    if (isCreateMode && !isValidPassword(form.password, form)) {
      nextErrors.password = PASSWORD_POLICY_MESSAGE;
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      nextErrors.employeeId = "Выберите сотрудника.";
    }
    if (!selectedRole) nextErrors.role = "Выберите роль.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length || !selectedRole) return;
    onSubmit({
      email: form.email.trim(),
      employeeId,
      password: isCreateMode ? form.password : undefined,
      role: selectedRole.value,
      username: form.username.trim(),
    });
  };

  return (
    <GuardedAdminModal
      hasChanges={comparable(form) !== comparable(initialForm)}
      isCloseDisabled={isSaving}
      onClose={onClose}
      title={
        isCreateMode ? "Новая учётная запись" : "Редактирование учётной записи"
      }
    >
      {(requestLeave) => (
        <form className="admin-form" onSubmit={handleSubmit}>
          <SelectDropdown
            disabled={isSaving}
            label="Сотрудник"
            error={fieldErrors.employeeId}
            onChange={(value) => updateField("employeeId", value)}
            options={employees.map((employee) => ({
              disabled:
                !employee.isActive && String(employee.id) !== form.employeeId,
              label: `${employee.fullName} — ${employee.position}${
                employee.isActive ? "" : " (отключён)"
              }`,
              value: String(employee.id),
            }))}
            placeholder="Выберите сотрудника"
            required
            value={form.employeeId}
          />
          <FormField label="Email" required error={fieldErrors.email}>
            <input
              disabled={isSaving}
              maxLength={255}
              onChange={(event) => updateField("email", event.target.value)}
              type="email"
              value={form.email}
            />
          </FormField>
          <FormField label="Логин" required error={fieldErrors.username}>
            <input
              disabled={isSaving}
              maxLength={64}
              onChange={(event) => updateField("username", event.target.value)}
              value={form.username}
            />
          </FormField>
          {isCreateMode ? (
            <FormField label="Пароль" required error={fieldErrors.password}>
              <input
                disabled={isSaving}
                minLength={8}
                maxLength={MAX_PASSWORD_LENGTH}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                type="password"
                value={form.password}
              />
            </FormField>
          ) : null}
          <SelectDropdown
            disabled={isSaving}
            label="Роль"
            error={fieldErrors.role}
            onChange={(value) => updateField("role", value)}
            options={roles.map((role) => ({
              label: role.label,
              value: role.value,
            }))}
            required
            value={form.role}
          />

          <div className="admin-form-actions">
            <button
              className="admin-secondary-button"
              disabled={isSaving}
              onClick={() => requestLeave(onClose)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="admin-primary-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}
    </GuardedAdminModal>
  );
}
