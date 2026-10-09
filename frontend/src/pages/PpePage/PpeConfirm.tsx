import { useState } from "react";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { ppeError } from "../../modules/ppe-ui/ppe-presentation";
export function PpeConfirm({
  title,
  text,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      title={title}
      description={text}
      cancelLabel="Назад"
      confirmLabel="Подтвердить"
      loadingLabel="Сохранение..."
      isLoading={saving}
      error={error}
      onCancel={onClose}
      onConfirm={() => {
        setSaving(true);
        setError(null);
        void onConfirm()
          .then(onClose)
          .catch((e) => setError(ppeError(e)))
          .finally(() => setSaving(false));
      }}
    />
  );
}
