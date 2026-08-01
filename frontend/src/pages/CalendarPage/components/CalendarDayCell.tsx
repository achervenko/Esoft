import type { MouseEvent } from "react";
import type {
  CalendarDayType,
  CalendarLayerItemDto,
} from "../../../shared/api/calendar";
import { CALENDAR_MAX_EVENT_DOTS } from "../model/calendar-page.constants";
import type { CalendarPeriodCell } from "../model/calendar-page.types";
import { CalendarEventIcon } from "./CalendarEventIcon";

type CalendarDayCellProps = {
  cell: CalendarPeriodCell;
  isSelected: boolean;
  onEventOpen: (event: CalendarLayerItemDto, dateId: string) => void;
  onOpenDay: (cell: CalendarPeriodCell) => void;
  onSelect: (cell: CalendarPeriodCell) => void;
};

export function CalendarDayCell({
  cell,
  isSelected,
  onEventOpen,
  onOpenDay,
  onSelect,
}: CalendarDayCellProps) {
  const className = [
    "calendar-day-cell",
    getCalendarDayTypeClass(cell.day?.type),
    cell.isPrimaryPeriod ? "current-month" : "outside-month",
    cell.isToday ? "today" : "",
    isSelected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      onClick={() => onSelect(cell)}
      onDoubleClick={() => onOpenDay(cell)}
    >
      <span className="calendar-day-number">{cell.date.getDate()}</span>

      {cell.events.length > 0 ? (
        <div
          className="calendar-day-events"
          aria-label={`${cell.events.length} событий`}
        >
          {cell.events.slice(0, CALENDAR_MAX_EVENT_DOTS).map((event, index) => (
            <button
              aria-label={`Открыть событие: ${event.title}`}
              className="calendar-event-icon"
              key={`${event.id}-${index}`}
              onClick={(clickEvent) => {
                handleCalendarEventClick(
                  clickEvent,
                  event,
                  cell.dateId,
                  onEventOpen,
                );
              }}
              onDoubleClick={handleCalendarEventDoubleClick}
              type="button"
            >
              <CalendarEventIcon
                icon={event.icon}
                size={20}
                strokeWidth={1.9}
              />
            </button>
          ))}
          {cell.events.length > CALENDAR_MAX_EVENT_DOTS ? (
            <span className="calendar-event-count">
              +{cell.events.length - CALENDAR_MAX_EVENT_DOTS}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function handleCalendarEventDoubleClick(
  clickEvent: MouseEvent<HTMLButtonElement>,
) {
  clickEvent.preventDefault();
  clickEvent.stopPropagation();
}

function handleCalendarEventClick(
  clickEvent: MouseEvent<HTMLButtonElement>,
  event: CalendarLayerItemDto,
  dateId: string,
  onEventOpen: (event: CalendarLayerItemDto, dateId: string) => void,
) {
  clickEvent.preventDefault();
  clickEvent.stopPropagation();
  onEventOpen(event, dateId);
}

function getCalendarDayTypeClass(type: CalendarDayType | undefined) {
  switch (type) {
    case "WORKING":
      return "type-working";
    case "WEEKEND":
      return "type-weekend";
    case "HOLIDAY":
      return "type-holiday";
    case "SHORTENED":
      return "type-shortened";
    default:
      return "type-unknown";
  }
}
