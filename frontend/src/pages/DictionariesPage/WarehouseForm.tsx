import { useState } from "react";
import type { Warehouse } from "../../shared/api/warehouses-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  AdminFormActions,
  AdminTextField,
} from "../../shared/ui/AdminFormControls";
import { Notice } from "../../shared/ui/Notice";
export function WarehouseForm({
  item,
  saving,
  error,
  onSave,
  onClose,
}: {
  item: Warehouse | null;
  saving: boolean;
  error: string | null;
  onSave: (input: { name: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const unchanged = !!item && name.trim() === item.name;
  return (
    <AdminModal
      title={item ? "Изменить склад" : "Новый склад"}
      isCloseDisabled={saving}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving && name.trim() && !unchanged)
            void onSave({ name: name.trim() });
        }}
      >
        <AdminTextField
          label="Наименование"
          value={name}
          onChange={setName}
          disabled={saving}
          required
          maxLength={255}
          autoFocus
        />
        {error && <Notice tone="error">{error}</Notice>}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={!name.trim() || unchanged}
        />
      </form>
    </AdminModal>
  );
}
