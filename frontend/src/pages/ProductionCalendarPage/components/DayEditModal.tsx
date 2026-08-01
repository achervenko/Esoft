import { CalendarDays, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminModal } from "../../../shared/ui/AdminModal";
import { DAY_TYPE_LABELS, DAY_TYPES } from "../model/constants";
import { formatLongDate } from "../model/calendar.utils";
import type { CalendarDayDraft, CalendarDayState } from "../model/types";
import "./DayEditModal.css";

type DayEditModalProps = {
  day: CalendarDayState;
  isSaving: boolean;
  onClose: () => void;
  onReset: (day: CalendarDayState) => Promise<void>;
  onSave: (day: CalendarDayState, draft: CalendarDayDraft) => Promise<void>;
};

export function DayEditModal({
  day,
  isSaving,
  onClose,
  onReset,
  onSave,
}: DayEditModalProps) {
  const [draft, setDraft] = useState<CalendarDayDraft>({
    comment: day.comment,
    type: day.type,
  });

  useEffect(() => {
    setDraft({
      comment: day.comment,
      type: day.type,
    });
  }, [day]);

  return (
    <AdminModal
      className="production-calendar-edit-modal"
      isCloseDisabled={isSaving}
      onClose={onClose}
      title="Редактирование"
    >
      <form
        className="admin-form production-calendar-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(day, draft);
        }}
      >
        <section className="production-calendar-edit-date">
          <CalendarDays size={22} />
          <div>
            <strong>{formatLongDate(day.date)}</strong>
          </div>
        </section>

        <fieldset className="production-calendar-type-field">
          <legend>Тип дня</legend>
          <div>
            {DAY_TYPES.map((type) => (
              <button
                aria-pressed={draft.type === type}
                className={draft.type === type ? "active" : undefined}
                disabled={isSaving}
                key={type}
                onClick={() => setDraft((current) => ({ ...current, type }))}
                type="button"
              >
                <span className={`production-calendar-type-dot ${type}`} />
                <span>{DAY_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="form-field">
          Комментарий
          <textarea
            autoFocus
            disabled={isSaving}
            maxLength={220}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                comment: event.target.value,
              }))
            }
            value={draft.comment}
          />
        </label>

        <div className="admin-form-actions production-calendar-edit-actions">
          <button
            className="admin-secondary-button"
            disabled={isSaving}
            onClick={() => {
              void onReset(day);
            }}
            type="button"
          >
            <RotateCcw size={17} />
            Вернуть по умолчанию
          </button>
          <button
            className="admin-secondary-button"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button className="admin-primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
