import { useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import { Switch } from "../../shared/ui/Switch";
import {
  AdminTextField,
  AdminTextareaField,
  AdminFormActions,
} from "../../shared/ui/AdminFormControls";
import type {
  WarehouseItem,
  WarehouseItemInput,
  WarehouseCatalogError,
} from "../../shared/api/warehouse-catalog-api";
export function WarehouseCatalogItemForm({
  item,
  saving,
  error,
  onSave,
  onClose,
  onToggle,
}: {
  item: WarehouseItem | null;
  saving: boolean;
  error: WarehouseCatalogError | null;
  onSave: (input: WarehouseItemInput) => Promise<void>;
  onClose: () => void;
  onToggle: () => Promise<void>;
}) {
  const [values, setValues] = useState({
    article: item?.article ?? "",
    name: item?.name ?? "",
    unit: item?.unit ?? "",
    comment: item?.comment ?? "",
  });
  const normalized: WarehouseItemInput = {
    article: values.article.trim(),
    name: values.name.trim(),
    unit: values.unit.trim(),
    comment: values.comment.trim() || null,
  };
  const unchanged =
    !!item &&
    Object.entries(normalized).every(
      ([key, value]) => value === item[key as keyof WarehouseItemInput],
    );
  return (
    <AdminModal
      title={item ? "Изменить номенклатуру" : "Новая номенклатура"}
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !saving &&
            !unchanged &&
            normalized.article &&
            normalized.name &&
            normalized.unit
          )
            void onSave(normalized);
        }}
      >
        {(
          [
            ["article", "Артикул", 100],
            ["name", "Наименование", 255],
            ["unit", "Ед. изм.", 50],
          ] as const
        ).map(([key, label, limit]) => (
          <AdminTextField
            key={key}
            label={label}
            autoFocus={key === "article"}
            required
            maxLength={limit}
            value={values[key]}
            disabled={saving}
            error={error?.field === key ? error.message : undefined}
            onChange={(value) => setValues((v) => ({ ...v, [key]: value }))}
          />
        ))}
        <AdminTextareaField
          label="Комментарий"
          value={values.comment}
          disabled={saving}
          onChange={(value) => setValues((v) => ({ ...v, comment: value }))}
        />
        {error && !error.field && <Notice tone="error">{error.message}</Notice>}
        {item && (
          <div className="warehouse-catalog-form-status">
            <span>{item.isActive ? "Активна" : "Неактивна"}</span>
            <Switch
              label="Активность номенклатуры"
              checked={item.isActive}
              disabled={saving}
              onChange={() => void onToggle()}
            />
          </div>
        )}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={
            unchanged ||
            !normalized.article ||
            !normalized.name ||
            !normalized.unit
          }
        />
      </form>
    </AdminModal>
  );
}
