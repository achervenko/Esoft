import { useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import { Switch } from "../../shared/ui/Switch";
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
          <label className="form-field" key={key}>
            <span className="form-field-label">{label}</span>
            <input
              autoFocus={key === "article"}
              required
              maxLength={limit}
              value={values[key]}
              disabled={saving}
              aria-invalid={
                key === "article" && error?.field === "article"
                  ? true
                  : undefined
              }
              aria-describedby={
                key === "article" && error?.field === "article"
                  ? "warehouse-article-error"
                  : undefined
              }
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        <label className="form-field">
          <span className="form-field-label">Комментарий</span>
          <textarea
            value={values.comment}
            disabled={saving}
            onChange={(e) =>
              setValues((v) => ({ ...v, comment: e.target.value }))
            }
          />
        </label>
        {error && (
          <div
            id={
              error.field === "article" ? "warehouse-article-error" : undefined
            }
          >
            <Notice tone="error">{error.message}</Notice>
          </div>
        )}
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
        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={
              saving ||
              unchanged ||
              !normalized.article ||
              !normalized.name ||
              !normalized.unit
            }
          >
            Сохранить
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
