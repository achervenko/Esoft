import { useRef, useState } from "react";
import type { ChecklistTemplateDetail } from "../../shared/api/checklists";
import {
  AdminFormActions,
  AdminTextareaField,
  AdminTextField,
} from "../../shared/ui/AdminFormControls";
import { AdminModal } from "../../shared/ui/AdminModal";

type TemplateMainDataModalProps = {
  autoFocusName?: boolean;
  initialError?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: { description?: string | null; name: string }) => void;
  selectNameOnFocus?: boolean;
  template: ChecklistTemplateDetail;
};

export function TemplateMainDataModal({
  autoFocusName = false,
  initialError = null,
  isSaving,
  onClose,
  onSubmit,
  selectNameOnFocus = false,
  template,
}: TemplateMainDataModalProps) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [error, setError] = useState<string | null>(initialError);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <AdminModal
      isCloseDisabled={isSaving}
      onClose={onClose}
      title="Основные данные"
    >
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedName = name.trim();

          if (!trimmedName) {
            setError("Укажите название шаблона.");
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
          autoFocus={autoFocusName}
          disabled={isSaving}
          inputRef={nameInputRef}
          label="Название шаблона"
          maxLength={160}
          onChange={(value) => {
            setName(value);
            setError(null);
          }}
          required
          selectOnFocus={selectNameOnFocus}
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
