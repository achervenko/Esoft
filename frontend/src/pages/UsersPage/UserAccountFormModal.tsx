import { TextField } from "../../shared/ui/TextField";
import { useId, useRef, useState } from "react";
import { getUserRoles, USER_ROLES } from "../../shared/lib/user-roles";
import { getProfileRoleLabel } from "../../modules/user-profile/profile-access";
import { Checkbox } from "@chakra-ui/react";
import "./UsersPage.css";
import {
  isValidPassword,
  MAX_PASSWORD_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from "../../shared/lib/password-validation";
import type {
  AdminEmployee,
  AdminRoleOption,
  AdminUserAccount,
  UserAccountPayload,
} from "../../shared/api/users-admin-api";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";

type UserAccountFormModalProps = {
  employees: AdminEmployee[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: UserAccountPayload) => Promise<void>;
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
    role: getUserRoles(
      user?.role ??
        (roles.some((role) => role.value === "operator") ? "operator" : ""),
    ).join(","),
    username: user?.username ?? "",
  });
  const [form, setForm] = useState(initialForm);
  const submittingRef = useRef(false);
  const comparable = (value: typeof form) =>
    JSON.stringify([
      value.email.trim().toLowerCase(),
      value.employeeId,
      value.password,
      getUserRoles(value.role).sort().join(","),
      value.username.trim().toLowerCase(),
    ]);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof typeof form, string>>
  >({});
  const isCreateMode = !user;
  const roleErrorId = useId();
  const retainedRoles = getUserRoles(user?.role).filter(
    (value) => !roles.some((role) => role.value === value),
  );
  const roleOptions = [
    ...roles,
    ...retainedRoles.map((value) => ({
      value,
      label: `${getProfileRoleLabel(value)} (модуль выключен)`,
    })),
  ];
  const selectedRoles = getUserRoles(form.role);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const employeeId = Number(form.employeeId);
    const validRoles =
      selectedRoles.length > 0 &&
      selectedRoles.every((value) =>
        roleOptions.some((role) => role.value === value),
      );

    if (isSaving || submittingRef.current) {
      return;
    }

    const nextErrors: typeof fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Укажите корректный email.";
    }

    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(form.username.trim())) {
      nextErrors.username =
        "Логин должен содержать 3–64 латинских символа, цифры, точку, дефис или нижнее подчёркивание.";
    }

    if (isCreateMode && !isValidPassword(form.password, form)) {
      nextErrors.password = PASSWORD_POLICY_MESSAGE;
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      nextErrors.employeeId = "Выберите сотрудника.";
    }
    if (!validRoles) nextErrors.role = "Выберите хотя бы одну роль.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length || !validRoles) return;
    submittingRef.current = true;
    try {
      await onSubmit({
        email: form.email.trim(),
        employeeId,
        password: isCreateMode ? form.password : undefined,
        role: USER_ROLES.filter((value) => selectedRoles.includes(value)).join(
          ",",
        ),
        username: form.username.trim(),
      });
    } finally {
      submittingRef.current = false;
    }
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
            options={employees
              .filter(
                (employee) =>
                  employee.isActive || employee.id === user?.employee?.id,
              )
              .map((employee) => ({
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
          <TextField
            label="Email"
            required
            error={fieldErrors.email}
            disabled={isSaving}
            maxLength={255}
            onChange={(value) => updateField("email", value)}
            type="email"
            value={form.email}
          />
          <TextField
            label="Логин"
            required
            error={fieldErrors.username}
            disabled={isSaving}
            maxLength={64}
            onChange={(value) => updateField("username", value)}
            value={form.username}
          />
          {isCreateMode ? (
            <TextField
              label="Пароль"
              required
              error={fieldErrors.password}
              disabled={isSaving}
              minLength={8}
              maxLength={MAX_PASSWORD_LENGTH}
              onChange={(value) => updateField("password", value)}
              type="password"
              value={form.password}
            />
          ) : null}
          <fieldset
            className="user-account-roles"
            aria-label="Роль"
            aria-invalid={fieldErrors.role ? true : undefined}
            aria-describedby={fieldErrors.role ? roleErrorId : undefined}
          >
            <legend>Роли</legend>
            {roleOptions.map((role) => (
              <Checkbox.Root
                key={role.value}
                className="user-account-role-checkbox"
                checked={selectedRoles.includes(role.value)}
                disabled={
                  isSaving ||
                  (retainedRoles.includes(role.value) &&
                    !selectedRoles.includes(role.value))
                }
                onCheckedChange={({ checked }) =>
                  updateField(
                    "role",
                    USER_ROLES.filter((value) =>
                      value === role.value
                        ? checked === true
                        : selectedRoles.includes(value),
                    ).join(","),
                  )
                }
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>{role.label}</Checkbox.Label>
              </Checkbox.Root>
            ))}
            {fieldErrors.role ? (
              <small id={roleErrorId} className="field-error">
                {fieldErrors.role}
              </small>
            ) : null}
          </fieldset>

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
