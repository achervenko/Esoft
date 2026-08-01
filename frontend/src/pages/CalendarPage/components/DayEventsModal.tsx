import type { CalendarLayerItemDto } from "../../../shared/api/calendar";
import { AdminModal } from "../../../shared/ui/AdminModal";
import { CalendarEventIcon } from "./CalendarEventIcon";
import type { CalendarPeriodCell } from "../model/calendar-page.types";
import "./CalendarEventCard.css";
import "./DayEventsModal.css";

type DayEventsModalProps = {
  day: CalendarPeriodCell;
  onClose: () => void;
  onEventOpen: (event: CalendarLayerItemDto, dateId: string) => void;
};

export function DayEventsModal({
  day,
  onClose,
  onEventOpen,
}: DayEventsModalProps) {
  return (
    <AdminModal
      className="calendar-events-modal"
      onClose={onClose}
      title={
        <span className="calendar-events-modal-title">
          <span>{formatModalDate(day.date)}</span>
          <span>{formatWeekday(day.date)}</span>
        </span>
      }
    >
      <div className="calendar-events-modal-content">
        <section className="calendar-events-modal-section">
          <header>
            <h3>{formatEventsCount(day.events.length)}</h3>
          </header>

          <div className="calendar-events-list-shell">
            {day.events.length > 0 ? (
              <ul className="calendar-events-list">
                {day.events.map((event) => (
                  <DayEventCard
                    event={event}
                    key={event.id}
                    onOpen={() => onEventOpen(event, day.dateId)}
                  />
                ))}
              </ul>
            ) : (
              <p className="calendar-events-empty">
                На выбранную дату событий нет.
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminModal>
  );
}

function DayEventCard({
  event,
  onOpen,
}: {
  event: CalendarLayerItemDto;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        className="calendar-event-card"
        onClick={onOpen}
        type="button"
      >
        <span className="calendar-event-card-icon" aria-hidden="true">
          <CalendarEventIcon icon={event.icon} size={17} strokeWidth={2.2} />
        </span>

        <span className="calendar-event-card-body">
          <span className="calendar-event-card-title-row">
            <strong>{event.title}</strong>
            {event.badge ? (
              <span className="calendar-event-type-badge">{event.badge}</span>
            ) : null}
          </span>

          {event.subtitle || event.description ? (
            <span className="calendar-event-card-meta">
              {event.subtitle ? <span>{event.subtitle}</span> : null}
              {event.description ? <span>{event.description}</span> : null}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function formatEventsCount(count: number) {
  return `${count} ${getEventWord(count)}`;
}

function getEventWord(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "событий";
  }

  if (lastDigit === 1) {
    return "событие";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "события";
  }

  return "событий";
}

function formatModalDate(value: Date) {
  return value.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekday(value: Date) {
  return value.toLocaleDateString("ru-RU", {
    weekday: "long",
  });
}
