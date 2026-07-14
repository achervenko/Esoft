import { useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";

type ParentOption = {
  id: number;
  name: string;
};

type ParentNameDictionaryFormModalProps = {
  initialName?: string;
  initialParentId?: number | null;
  isSaving: boolean;
  nameLabel: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; parentId: number }) => void;
  parentLabel: string;
  parentOptions: ParentOption[];
  title: string;
};

export function ParentNameDictionaryFormModal({
  initialName = "",
  initialParentId = null,
  isSaving,
  nameLabel,
  onClose,
  onSubmit,
  parentLabel,
  parentOptions,
  title,
}: ParentNameDictionaryFormModalProps) {
  const [form, setForm] = useState({
    name: initialName,
    parentId: initialParentId ? String(initialParentId) : "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const parentId = Number(form.parentId);
    const name = form.name.trim();

    if (!name || !Number.isInteger(parentId) || parentId <= 0) {
      setError(`Укажите ${parentLabel.toLowerCase()} и название.`);
      return;
    }

    setError(null);
    onSubmit({ name, parentId });
  };

  return (
    <AdminModal onClose={onClose} title={title}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <SelectDropdown
          label={parentLabel}
          onChange={(value) =>
            setForm((currentForm) => ({
              ...currentForm,
              parentId: value,
            }))
          }
          options={parentOptions.map((option) => ({
            label: option.name,
            value: String(option.id),
          }))}
          placeholder={`Выберите ${parentLabel.toLowerCase()}`}
          required
          value={form.parentId}
        />

        <label className="form-field">
          <span>
            {nameLabel}
            <b aria-hidden="true">*</b>
          </span>
          <input
            autoFocus
            maxLength={128}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                name: event.target.value,
              }))
            }
            value={form.name}
          />
        </label>

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
