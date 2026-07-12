import { useState } from "react";
import type {
  CountryPayload,
  DictionaryCountry,
} from "../../shared/api/dictionaries-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";

type CountryFormModalProps = {
  country: DictionaryCountry | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: CountryPayload) => void;
};

export function CountryFormModal({
  country,
  isSaving,
  onClose,
  onSubmit,
}: CountryFormModalProps) {
  const [form, setForm] = useState({
    iso: country?.iso ?? "",
    name: country?.name ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const iso = form.iso.trim().toUpperCase();
    const name = form.name.trim();

    if (!name || !iso) {
      setError("Укажите страну и ISO-код.");
      return;
    }

    if (!/^[A-Z]{2}$/.test(iso)) {
      setError("ISO-код должен состоять из двух латинских букв.");
      return;
    }

    setError(null);
    onSubmit({ iso, name });
  };

  return (
    <AdminModal
      onClose={onClose}
      title={country ? "Редактирование страны" : "Новая страна"}
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>
            Страна<b aria-hidden="true">*</b>
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
        <label className="form-field">
          <span>
            ISO<b aria-hidden="true">*</b>
          </span>
          <input
            maxLength={2}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                iso: event.target.value.toUpperCase(),
              }))
            }
            value={form.iso}
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
