import { RequiredMark } from "../../shared/ui/RequiredMark";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { useState } from "react";
import type {
  AdminEmployee,
  AdminPosition,
  EmployeePayload,
} from "../../shared/api/users-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";

type EmployeeDictionaryFormModalProps = {
  employee: AdminEmployee | null;
  positions: AdminPosition[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: EmployeePayload) => void;
};

export function EmployeeDictionaryFormModal({
  employee,
  positions,
  isSaving,
  onClose,
  onSubmit,
}: EmployeeDictionaryFormModalProps) {
  const [form, setForm] = useState<EmployeePayload>({
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    middleName: employee?.middleName ?? "",
    positionId: employee?.positionId ?? 0,
  });
  const [error, setError] = useState<string | null>(null);

  const updateField = (
    field: keyof EmployeePayload,
    value: string | number,
  ) => {
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

    if (!form.lastName.trim() || !form.firstName.trim() || !form.positionId) {
      setError("Заполните фамилию, имя и должность.");
      return;
    }

    setError(null);
    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName?.trim() || null,
      positionId: form.positionId,
    });
  };

  return (
    <AdminModal
      isCloseDisabled={isSaving}
      onClose={onClose}
      title={employee ? "Редактирование сотрудника" : "Новый сотрудник"}
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span className="form-field-label">
            Фамилия<RequiredMark />
          </span>
          <input
            autoFocus
            data-dialog-autofocus
            maxLength={64}
            onChange={(event) => updateField("lastName", event.target.value)}
            required
            value={form.lastName}
          />
        </label>
        <label className="form-field">
          <span className="form-field-label">
            Имя<RequiredMark />
          </span>
          <input
            maxLength={64}
            onChange={(event) => updateField("firstName", event.target.value)}
            required
            value={form.firstName}
          />
        </label>
        <label className="form-field">
          <span className="form-field-label">Отчество</span>
          <input
            maxLength={64}
            onChange={(event) => updateField("middleName", event.target.value)}
            value={form.middleName ?? ""}
          />
        </label>
        <label className="form-field">
          <span className="form-field-label">
            Должность<RequiredMark />
          </span>
          <AppSelect
            required
            onChange={(event) =>
              updateField("positionId", Number(event.target.value))
            }
            value={form.positionId}
          >
            <option value={0}>Выберите должность</option>
            {positions
              .filter(
                (item) => item.isActive || item.id === employee?.positionId,
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.isActive ? "" : " (удалена)"}
                </option>
              ))}
          </AppSelect>
          {positions.every((item) => !item.isActive) ? (
            <small>
              Добавьте или включите должность во вкладке «Должности».
            </small>
          ) : null}
        </label>

        {error ? <p className="admin-form-error">{error}</p> : null}

        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            disabled={isSaving}
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
