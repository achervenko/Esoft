import { useState } from "react";
import type { StorageLocation } from "../../shared/api/storage-locations-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";

export function StorageLocationForm({
  item,
  saving,
  error,
  onClose,
  onSave,
}: {
  item: StorageLocation | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (v: {
    code: string;
    name: string;
    isActive: boolean;
  }) => Promise<unknown>;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  return (
    <AdminModal
      title={item ? "Изменить место хранения" : "Новое место хранения"}
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim() && name.trim())
            void onSave({
              code: code.trim(),
              name: name.trim(),
              isActive: item?.isActive ?? true,
            });
        }}
      >
        <label className="form-field">
          <span className="form-field-label">Код</span>
          <input
            autoFocus
            required
            maxLength={100}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-field-label">Наименование</span>
          <input
            required
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={
              saving ||
              !code.trim() ||
              !name.trim() ||
              !!(item && code.trim() === item.code && name.trim() === item.name)
            }
          >
            Сохранить
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
