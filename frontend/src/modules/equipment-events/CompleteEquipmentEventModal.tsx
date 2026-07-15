import { useState } from "react";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import { getBusinessTodayDateString } from "./equipment-events-date";

type CompleteEquipmentEventModalProps = {
  error?: string | null;
  event: EquipmentEventItem;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (factDate: string) => void;
};

export function CompleteEquipmentEventModal({
  error: serverError = null,
  event,
  isSaving,
  onClose,
  onSubmit,
}: CompleteEquipmentEventModalProps) {
  const today = getBusinessTodayDateString();
  const [factDate, setFactDate] = useState(event.factDate ?? today);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (isSaving) {
      return;
    }

    if (!factDate) {
      setError("Укажите фактическую дату.");
      return;
    }

    setError(null);
    onSubmit(factDate);
  };

  return (
    <AdminModal onClose={onClose} title="Завершить событие">
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>
            Фактическая дата<b aria-hidden="true">*</b>
          </span>
          <input
            max={today}
            onChange={(inputEvent) => setFactDate(inputEvent.target.value)}
            type="date"
            value={factDate}
          />
        </label>

        {error || serverError ? (
          <p className="admin-form-error">{error ?? serverError}</p>
        ) : null}

        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Завершение..." : "Завершить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
