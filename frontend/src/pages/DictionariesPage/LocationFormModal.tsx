import { useState } from "react";
import type {
  DictionaryLocation,
  DictionaryObject,
  LocationPayload,
} from "../../shared/api/dictionaries-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";

type LocationFormModalProps = {
  isSaving: boolean;
  location: DictionaryLocation | null;
  objects: DictionaryObject[];
  onClose: () => void;
  onSubmit: (payload: LocationPayload) => void;
};

export function LocationFormModal({
  isSaving,
  location,
  objects,
  onClose,
  onSubmit,
}: LocationFormModalProps) {
  const [form, setForm] = useState({
    name: location?.name ?? "",
    objectId: location?.workshopId ? String(location.workshopId) : "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const objectId = Number(form.objectId);
    const name = form.name.trim();

    if (!name || !Number.isInteger(objectId) || objectId <= 0) {
      setError("Укажите объект и название местонахождения.");
      return;
    }

    setError(null);
    onSubmit({ name, objectId });
  };

  return (
    <AdminModal
      onClose={onClose}
      title={
        location ? "Редактирование местонахождения" : "Новое местонахождение"
      }
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <SelectDropdown
          label="Объект"
          onChange={(value) =>
            setForm((currentForm) => ({
              ...currentForm,
              objectId: value,
            }))
          }
          options={objects.map((object) => ({
            label: object.name,
            value: String(object.id),
          }))}
          placeholder="Выберите объект"
          required
          value={form.objectId}
        />

        <label className="form-field">
          <span>
            Местонахождение<b aria-hidden="true">*</b>
          </span>
          <input
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
