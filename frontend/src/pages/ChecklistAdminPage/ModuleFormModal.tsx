import { useRef, useState } from "react";
import type { ChecklistModule } from "../../shared/api/checklists";
import {
  AdminFormActions,
  AdminTextareaField,
  AdminTextField,
} from "../../shared/ui/AdminFormControls";
import { AdminModal } from "../../shared/ui/AdminModal";

type ModuleFormModalProps = {
  isSaving: boolean;
  item: ChecklistModule | null;
  onClose: () => void;
  onSubmit: (payload: { description?: string | null; name: string }) => void;
};

export function ModuleFormModal({
  isSaving,
  item,
  onClose,
  onSubmit,
}: ModuleFormModalProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <AdminModal
      onClose={onClose}
      title={item ? "Редактировать модуль" : "Создать модуль"}
    >
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedName = name.trim();

          if (!trimmedName) {
            setError("Укажите название модуля.");
            nameInputRef.current?.focus();
            return;
          }

          onSubmit({
            description: description.trim() || null,
            name: trimmedName,
          });
        }}
      >
        <AdminTextField
          autoFocus={!item}
          disabled={isSaving}
          inputRef={nameInputRef}
          label="Название модуля"
          maxLength={128}
          onChange={(value) => {
            setName(value);
            setError(null);
          }}
          required
          value={name}
        />
        <AdminTextareaField
          disabled={isSaving}
          label="Описание"
          onChange={setDescription}
          value={description}
        />
        {error ? <p className="admin-form-error">{error}</p> : null}
        <AdminFormActions isSaving={isSaving} onClose={onClose} />
      </form>
    </AdminModal>
  );
}
