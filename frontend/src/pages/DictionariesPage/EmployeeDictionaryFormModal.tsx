import { AdminTextField } from "../../shared/ui/AdminFormControls";
import { GenderToggle } from "../../shared/ui/GenderToggle";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { useRef, useState } from "react";
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
  onSubmit: (payload: EmployeePayload) => void | Promise<void>;
};

export function EmployeeDictionaryFormModal({
  employee,
  positions,
  isSaving,
  onClose,
  onSubmit,
}: EmployeeDictionaryFormModalProps) {
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">(
    employee?.gender ?? "",
  );
  const [form, setForm] = useState<Omit<EmployeePayload, "gender">>({
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    middleName: employee?.middleName ?? "",
    positionId: employee?.positionId ?? 0,
    additionalPositionIds:
      employee?.additionalPositions?.map(({ id }) => id) ?? [],
  });
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (
    field: keyof Omit<EmployeePayload, "gender">,
    value: string | number,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === "positionId"
        ? {
            additionalPositionIds: currentForm.additionalPositionIds?.filter(
              (id) => id !== value,
            ),
          }
        : {}),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || submittingRef.current) {
      return;
    }

    if (
      !form.lastName.trim() ||
      !form.firstName.trim() ||
      !form.positionId ||
      !gender
    ) {
      setError("Заполните фамилию, имя, пол и должности.");
      return;
    }

    setError(null);
    submittingRef.current = true;
    try {
      await onSubmit({
        gender: gender as "MALE" | "FEMALE",
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName?.trim() || null,
        positionId: form.positionId,
        additionalPositionIds: form.additionalPositionIds,
      });
    } catch {
      setError("Не удалось сохранить сотрудника. Попробуйте ещё раз.");
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <AdminModal
      isCloseDisabled={isSaving}
      onClose={onClose}
      title={employee ? "Редактирование сотрудника" : "Новый сотрудник"}
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <AdminTextField
          label="Фамилия"
          disabled={isSaving}
          required
          autoFocus
          data-dialog-autofocus
          maxLength={64}
          onChange={(value) => updateField("lastName", value)}
          value={form.lastName}
        />
        <AdminTextField
          label="Имя"
          disabled={isSaving}
          required
          maxLength={64}
          onChange={(value) => updateField("firstName", value)}
          value={form.firstName}
        />
        <AdminTextField
          label="Отчество"
          disabled={isSaving}
          maxLength={64}
          onChange={(value) => updateField("middleName", value)}
          value={form.middleName ?? ""}
        />
        <GenderToggle value={gender} onChange={setGender} disabled={isSaving} />
        <SelectDropdown
          label="Должности"
          required
          disabled={isSaving}
          placeholder="Выберите должности"
          value={form.positionId ? String(form.positionId) : ""}
          selectedValues={[
            form.positionId,
            ...(form.additionalPositionIds ?? []),
          ]
            .filter(Boolean)
            .map(String)}
          options={positions
            .filter(
              (item) =>
                item.isActive ||
                item.id === employee?.positionId ||
                employee?.additionalPositions?.some(({ id }) => id === item.id),
            )
            .map((item) => ({
              value: String(item.id),
              label: item.name + (item.isActive ? "" : " (удалена)"),
              disabled:
                !item.isActive &&
                item.id !== form.positionId &&
                !form.additionalPositionIds?.includes(item.id),
            }))}
          onChange={(value) =>
            setForm((current) => {
              const id = Number(value);
              const selected = [
                current.positionId,
                ...(current.additionalPositionIds ?? []),
              ].filter(Boolean);
              const next = selected.includes(id)
                ? selected.filter((positionId) => positionId !== id)
                : [...selected, id];
              return {
                ...current,
                positionId: next[0] ?? 0,
                additionalPositionIds: next.slice(1),
              };
            })
          }
        />
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
