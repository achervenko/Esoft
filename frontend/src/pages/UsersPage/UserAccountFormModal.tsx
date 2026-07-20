import { useState } from "react";
import type {
  AdminEmployee,
  AdminRoleOption,
  AdminUserAccount,
  UserAccountPayload,
} from "../../shared/api/users-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";

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
  const [form, setForm] = useState({
    email: user?.email ?? "",
    employeeId: user?.employee?.id ? String(user.employee.id) : "",
    password: "",
    role: String(user?.role ?? "operator"),
    username: user?.username ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const isCreateMode = !user;

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const employeeId = Number(form.employeeId);
    const selectedRole = roles.find((role) => role.value === form.role);

    if (isSaving) {
      return;
    }

    if (
      !form.email.trim() ||
      !form.username.trim() ||
      !selectedRole ||
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      setError("Заполните сотрудника, email, логин и роль.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Укажите корректный email.");
      return;
    }

    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(form.username.trim())) {
      setError(
        "Логин может содержать латиницу, цифры, точку, дефис и нижнее подчёркивание.",
      );
      return;
    }

    if (isCreateMode && form.password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }

    setError(null);
    onSubmit({
      email: form.email.trim(),
      employeeId,
      password: isCreateMode ? form.password : undefined,
      role: selectedRole.value,
      username: form.username.trim(),
    });
  };

  return (
    <AdminModal
      onClose={onClose}
      title={
        isCreateMode ? "Новая учётная запись" : "Редактирование учётной записи"
      }
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <SelectDropdown
          label="Сотрудник"
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
        <label className="form-field">
          <span>
            Email<b aria-hidden="true">*</b>
          </span>
          <input
            maxLength={255}
            onChange={(event) => updateField("email", event.target.value)}
            type="email"
            value={form.email}
          />
        </label>
        <label className="form-field">
          <span>
            Логин<b aria-hidden="true">*</b>
          </span>
          <input
            maxLength={64}
            onChange={(event) => updateField("username", event.target.value)}
            value={form.username}
          />
        </label>
        {isCreateMode ? (
          <label className="form-field">
            <span>
              Пароль<b aria-hidden="true">*</b>
            </span>
            <input
              minLength={8}
              onChange={(event) => updateField("password", event.target.value)}
              type="password"
              value={form.password}
            />
          </label>
        ) : null}
        <SelectDropdown
          label="Роль"
          onChange={(value) => updateField("role", value)}
          options={roles.map((role) => ({
            label: role.label,
            value: role.value,
          }))}
          required
          value={form.role}
        />

        {error ? <p className="admin-form-error">{error}</p> : null}

        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            onClick={onClose}
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
    </AdminModal>
  );
}
