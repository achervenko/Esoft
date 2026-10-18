import { UnsavedChangesGuard } from "../../shared/ui/UnsavedChangesGuard";
import { useDraftChanges } from "../../shared/lib/use-draft-changes";
import { useRef, useState } from "react";
import { ppeApi, type PpeNorm } from "../../shared/api/ppe";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { businessToday, ppeError } from "../../modules/ppe-ui/ppe-presentation";
import { Field } from "../../modules/ppe-ui/ppe-ui";

export function NormLifecycleDialog({
  norm,
  deleting,
  previousNorm,
  nextNorm,
  onClose,
  onChanged,
}: {
  norm: PpeNorm;
  deleting: boolean;
  previousNorm?: PpeNorm | null;
  nextNorm?: PpeNorm | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(businessToday());
  const dateChanged = useDraftChanges(date);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const predecessorLabel =
    previousNorm && previousNorm.effectiveFrom <= businessToday()
      ? "Текущая норма"
      : "Предыдущая будущая норма";
  const deletionDescription = !previousNorm
    ? "Будущая норма будет удалена."
    : nextNorm
      ? `Будущая норма будет удалена. ${predecessorLabel} будет продлена до начала следующей нормы — ${nextNorm.effectiveFrom.split("-").reverse().join(".")}.`
      : `Будущая норма будет удалена. ${predecessorLabel} будет продлена без даты окончания, до введения новой нормы.`;
  const confirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (deleting) await ppeApi.deleteNorm(norm.id);
      else await ppeApi.endNorm(norm.id, date);
      onChanged();
      onClose();
    } catch (err) {
      setError(ppeError(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <UnsavedChangesGuard
      hasChanges={!deleting && dateChanged}
      isBlocked={saving}
    >
      {(requestLeave) => (
        <ConfirmDialog
          variant="danger"
          title={
            deleting ? "Удалить будущую норму?" : "Завершить действие нормы?"
          }
          description={
            deleting
              ? deletionDescription
              : "Норма действует по выбранную дату включительно. История выдач сохранится."
          }
          cancelLabel="Назад"
          confirmLabel={deleting ? "Удалить" : "Завершить действие"}
          isLoading={saving}
          loadingLabel="Сохранение…"
          error={error}
          isConfirmDisabled={
            !deleting &&
            (!date ||
              date < businessToday() ||
              Boolean(norm.effectiveTo && date > norm.effectiveTo))
          }
          onCancel={() => requestLeave(onClose)}
          onConfirm={() => {
            void confirm();
          }}
        >
          {!deleting && (
            <Field label="Последний день действия">
              <input
                type="date"
                value={date}
                min={businessToday()}
                max={norm.effectiveTo ?? undefined}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          )}
        </ConfirmDialog>
      )}
    </UnsavedChangesGuard>
  );
}
