import { Plus } from "lucide-react";
import { SizeListTable } from "./SizeListTable";
import { SizeEditForm } from "./SizeEditForm";
import { useRef, useState } from "react";
import { ppeApi, type PpeItem, type PpeSize } from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { ppeError, sizeLabel } from "../../modules/ppe-ui/ppe-presentation";
import { PpeConfirm } from "./PpeConfirm";
export function SizeListEditor({
  item,
  manage,
  onClose,
  onChanged,
}: {
  item: PpeItem;
  manage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<PpeSize | "new" | null>(null);
  const [value, setValue] = useState("");
  const [height, setHeight] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [toggle, setToggle] = useState<PpeSize | null>(null);
  const editingChanged =
    editing !== null &&
    (value !== (editing === "new" ? "" : editing.value) ||
      height !== (editing === "new" ? "" : (editing.heightValue ?? "")));
  if (toggle)
    return (
      <PpeConfirm
        title={toggle.isActive ? "Удалить размер?" : "Включить размер?"}
        text={sizeLabel(toggle.value, toggle.heightValue)}
        onClose={() => setToggle(null)}
        onConfirm={async () => {
          await ppeApi.sizeStatus(item.id, toggle.id, !toggle.isActive);
          onChanged();
        }}
      />
    );
  const edit = (size: PpeSize | "new") => {
    setEditing(size);
    setValue(size === "new" ? "" : size.value);
    setHeight(size === "new" ? "" : (size.heightValue ?? ""));
    setError(null);
  };
  return (
    <GuardedAdminModal
      hasChanges={manage && editingChanged}
      title={`Размеры: ${item.article} — ${item.name}`}
      onClose={onClose}
      isCloseDisabled={saving}
      className={
        item.type === "BODY" || item.type === "TSHIRT"
          ? "ppe-clothing-modal"
          : undefined
      }
    >
      {(requestLeave) => (
        <div className="ppe-form">
          <SizeListTable
            item={item}
            manage={manage}
            saving={saving}
            onEdit={edit}
            onToggle={setToggle}
          />
          {!item.sizes.length && (
            <p className="admin-state">Размеры пока не заведены.</p>
          )}
          {manage && !editing && (
            <button
              type="button"
              aria-label="Добавить размер"
              className="admin-secondary-button"
              onClick={() => edit("new")}
            >
              <Plus size={18} aria-hidden="true" />
              Добавить
            </button>
          )}
          {editing && (
            <SizeEditForm
              item={item}
              value={value}
              height={height}
              saving={saving}
              error={error}
              onValueChange={setValue}
              onHeightChange={setHeight}
              onBack={() => requestLeave(() => setEditing(null))}
              onSave={() => {
                if (savingRef.current) return;
                savingRef.current = true;
                setSaving(true);
                setError(null);
                void ppeApi
                  .saveSize(item.id, editing === "new" ? null : editing.id, {
                    value,
                    ...(item.type === "BODY" || item.type === "TSHIRT"
                      ? { heightValue: height }
                      : {}),
                  })
                  .then(() => {
                    setEditing(null);
                    onChanged();
                  })
                  .catch((err) => setError(ppeError(err)))
                  .finally(() => {
                    savingRef.current = false;
                    setSaving(false);
                  });
              }}
            />
          )}
        </div>
      )}
    </GuardedAdminModal>
  );
}
