import { useState } from "react";
import type { AdminEmployee, EmployeePayload } from "../../shared/api/users-admin-api";
import { AdminModal } from "./AdminModal";

type EmployeeFormModalProps = {
  employee: AdminEmployee | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: EmployeePayload) => void;
};

export function EmployeeFormModal({
  employee,
  isSaving,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) {
  const [form, setForm] = useState<EmployeePayload>({
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    middleName: employee?.middleName ?? "",
    position: employee?.position ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof EmployeePayload, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!form.lastName.trim() || !form.firstName.trim() || !form.position.trim()) {
      setError("Заполните фамилию, имя и должность.");
      return;
    }

    setError(null);
    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName?.trim() || null,
      position: form.position.trim(),
    });
  };

  return (
    <AdminModal
      onClose={onClose}
      title={employee ? "Редактирование сотрудника" : "Новый сотрудник"}
    >
      <form className="users-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Фамилия *</span>
          <input
            autoFocus
            maxLength={64}
            onChange={(event) => updateField("lastName", event.target.value)}
            value={form.lastName}
          />
        </label>
        <label className="form-field">
          <span>Имя *</span>
          <input
            maxLength={64}
            onChange={(event) => updateField("firstName", event.target.value)}
            value={form.firstName}
          />
        </label>
        <label className="form-field">
          <span>Отчество</span>
          <input
            maxLength={64}
            onChange={(event) => updateField("middleName", event.target.value)}
            value={form.middleName ?? ""}
          />
        </label>
        <label className="form-field">
          <span>Должность *</span>
          <input
            maxLength={64}
            onChange={(event) => updateField("position", event.target.value)}
            value={form.position}
          />
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
