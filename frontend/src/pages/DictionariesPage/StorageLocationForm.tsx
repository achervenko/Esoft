import { useState } from "react";
import type { StorageLocation } from "../../shared/api/storage-locations-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import {
  AdminTextField,
  AdminFormActions,
} from "../../shared/ui/AdminFormControls";

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
          if (!saving && code.trim() && name.trim())
            void onSave({
              code: code.trim(),
              name: name.trim(),
              isActive: item?.isActive ?? true,
            });
        }}
      >
        <AdminTextField
          label="Код"
          autoFocus
          required
          maxLength={100}
          value={code}
          disabled={saving}
          onChange={setCode}
        />
        <AdminTextField
          label="Наименование"
          required
          maxLength={255}
          value={name}
          disabled={saving}
          onChange={setName}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={
            !code.trim() ||
            !name.trim() ||
            !!(item && code.trim() === item.code && name.trim() === item.name)
          }
        />
      </form>
    </AdminModal>
  );
}
