import { useState } from "react";
import type {
  AdminEmployee,
  AdminRoleOption,
  AdminUserAccount,
  AdminUserRole,
  UserAccountPayload,
} from "../../shared/api/users-admin-api";
import { AdminModal } from "./AdminModal";

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
    role: (user?.role as AdminUserRole | null) ?? "operator",
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

    if (isSaving) {
      return;
    }

    if (
      !form.email.trim() ||
      !form.username.trim() ||
      !form.role ||
      !Number.isInteger(employeeId)
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
      role: form.role,
      username: form.username.trim(),
    });
  };

  return (
    <AdminModal
      onClose={onClose}
      title={isCreateMode ? "Новая учётная запись" : "Редактирование учётной записи"}
    >
      <form className="users-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Сотрудник *</span>
          <select
            autoFocus
            onChange={(event) => updateField("employeeId", event.target.value)}
            value={form.employeeId}
          >
            <option value="">Выберите сотрудника</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} — {employee.position}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Email *</span>
          <input
            maxLength={255}
            onChange={(event) => updateField("email", event.target.value)}
            type="email"
            value={form.email}
          />
        </label>
        <label className="form-field">
          <span>Логин *</span>
          <input
            maxLength={64}
            onChange={(event) => updateField("username", event.target.value)}
            value={form.username}
          />
        </label>
        {isCreateMode ? (
          <label className="form-field">
            <span>Пароль *</span>
            <input
              minLength={8}
              onChange={(event) => updateField("password", event.target.value)}
              type="password"
              value={form.password}
            />
          </label>
        ) : null}
        <label className="form-field">
          <span>Роль *</span>
          <select
            onChange={(event) => updateField("role", event.target.value)}
            value={form.role}
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="users-form-error">{error}</p> : null}

        <div className="users-form-actions">
          <button className="users-secondary-button" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="users-primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
