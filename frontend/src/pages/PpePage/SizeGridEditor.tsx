import { useState } from "react";
import { ShoeSizeRange } from "./ShoeSizeRange";
import { ClothingSizeGrid } from "./ClothingSizeGrid";
import { Message } from "../../modules/ppe-ui/ppe-ui";
import { ppeError } from "../../modules/ppe-ui/ppe-presentation";
import { ppeApi, type PpeItem } from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { useDraftChanges } from "../../shared/lib/use-draft-changes";
import { defaultClothingSizes } from "./ppe-size-options";

type GridDraft =
  | { type: "BODY"; values: { value: string; heightValue: string }[] }
  | { type: "FEET"; values: string[] };

function initialDraft(item: PpeItem): GridDraft {
  const active = item.sizes.filter((size) => size.isActive);
  return item.type === "BODY"
    ? {
        type: "BODY",
        values: active.length
          ? active.map((size) => ({
              value: size.value,
              heightValue: size.heightValue ?? "",
            }))
          : defaultClothingSizes(),
      }
    : { type: "FEET", values: active.map((size) => size.value) };
}

export function SizeGridEditor({
  item,
  onClose,
  onChanged,
}: {
  item: PpeItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChanges = useDraftChanges(
    (draft.type === "BODY"
      ? draft.values.map((pair) => pair.value + ";" + pair.heightValue)
      : [...draft.values]
    ).sort(),
  );
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const sizes =
        draft.type === "BODY"
          ? draft.values.map((pair) => ({
              value: `${pair.value};${pair.heightValue}`,
            }))
          : draft.values.map((value) => ({ value }));
      await ppeApi.replaceSizes(item.id, sizes);
      onChanged();
      onClose();
    } catch (err) {
      setError(ppeError(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <GuardedAdminModal
      hasChanges={hasChanges}
      title={`Размеры: ${item.article} — ${item.name}`}
      onClose={onClose}
      isCloseDisabled={saving}
      className={draft.type === "BODY" ? "ppe-clothing-modal" : undefined}
    >
      <div className="ppe-form">
        {draft.type === "FEET" ? (
          <ShoeSizeRange
            values={draft.values}
            disabled={saving}
            onChange={(values) => setDraft({ type: "FEET", values })}
          />
        ) : (
          <ClothingSizeGrid
            values={draft.values}
            disabled={saving}
            onChange={(values) => setDraft({ type: "BODY", values })}
          />
        )}
        {!item.sizes.some((size) => size.isActive) && (
          <p className="admin-state">Активных размеров пока нет.</p>
        )}
        <button
          type="button"
          className="admin-primary-button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Сохранение..." : "Сохранить размеры"}
        </button>
        <Message error={error} />
      </div>
    </GuardedAdminModal>
  );
}
