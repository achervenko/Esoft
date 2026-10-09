import type { PpeItem } from "../../shared/api/ppe";
import { normalizePpeSizeText } from "../../shared/lib/ppe-size-text";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import "../../modules/ppe-ui/PpeForm.css";
type SizeEditFormProps = {
  item: PpeItem;
  value: string;
  height: string;
  saving: boolean;
  error: string | null;
  onValueChange: (value: string) => void;
  onHeightChange: (height: string) => void;
  onSave: () => void;
  onBack: () => void;
};
export function SizeEditForm({
  item,
  value,
  height,
  saving,
  error,
  onValueChange,
  onHeightChange,
  onSave,
  onBack,
}: SizeEditFormProps) {
  return (
    <form
      className="ppe-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Field label="Размер">
        <input
          required
          maxLength={20}
          value={value}
          disabled={saving}
          onChange={(e) => onValueChange(normalizePpeSizeText(e.target.value))}
        />
      </Field>
      {item.type === "BODY" && (
        <Field label="Ростовка">
          <input
            required
            maxLength={20}
            value={height}
            disabled={saving}
            onChange={(e) =>
              onHeightChange(normalizePpeSizeText(e.target.value))
            }
          />
        </Field>
      )}
      <Message error={error} />
      <div className="ppe-actions">
        <button
          type="button"
          disabled={saving}
          className="admin-secondary-button"
          onClick={onBack}
        >
          Назад
        </button>
        <button className="admin-primary-button" disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить размер"}
        </button>
      </div>
    </form>
  );
}
