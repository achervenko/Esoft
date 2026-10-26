import {
  AdminTextField,
  AdminFormActions,
} from "../../shared/ui/AdminFormControls";
import { useState } from "react";
import type { DictionaryNamePayload } from "../../shared/api/dictionaries-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";

type NameDictionaryItem = {
  id: number;
  name: string;
};

type NameDictionaryFormModalProps = {
  item: NameDictionaryItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: DictionaryNamePayload) => void;
  title: string;
  maxLength?: number;
};

export function NameDictionaryFormModal({
  item,
  isSaving,
  onClose,
  onSubmit,
  title,
  maxLength = 128,
}: NameDictionaryFormModalProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!name.trim()) {
      setError("Укажите название.");
      return;
    }

    setError(null);
    onSubmit({ name: name.trim() });
  };

  return (
    <AdminModal isCloseDisabled={isSaving} onClose={onClose} title={title}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <AdminTextField
          label="Название"
          autoFocus
          data-dialog-autofocus
          maxLength={maxLength}
          required
          disabled={isSaving}
          error={error ?? undefined}
          onChange={setName}
          value={name}
        />
        <AdminFormActions isSaving={isSaving} onClose={onClose} />
      </form>
    </AdminModal>
  );
}
