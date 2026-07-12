import { useState } from "react";
import type { DictionaryNamePayload } from "../../shared/api/dictionaries-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";

type NameDictionaryItem = {
  id: number;
  name: string;
};

type NameDictionaryFormModalProps = {
  item: NameDictionaryItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: DictionaryNamePayload) => void;
  title: string;
};

export function NameDictionaryFormModal({
  item,
  isSaving,
  onClose,
  onSubmit,
  title,
}: NameDictionaryFormModalProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!name.trim()) {
      setError("Укажите название.");
      return;
    }

    setError(null);
    onSubmit({ name: name.trim() });
  };

  return (
    <AdminModal onClose={onClose} title={title}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>
            Название<b aria-hidden="true">*</b>
          </span>
          <input
            autoFocus
            maxLength={128}
            onChange={(event) => setName(event.target.value)}
            value={name}
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
