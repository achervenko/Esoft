import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import type { CalendarLayerItemDto } from "../../shared/api/calendar";
import { openCalendarNavigation } from "../../modules/calendar-navigation";
import { canViewCalendar } from "../../shared/lib/roles";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { Notice } from "../../shared/ui/Notice";
import { CalendarDayCell } from "./components/CalendarDayCell";
import { DayEventsModal } from "./components/DayEventsModal";
import { useCalendarMonth } from "./hooks/useCalendarMonth";
import { useCalendarZoom } from "./hooks/useCalendarZoom";
import { CALENDAR_WEEKDAY_LABELS } from "./model/calendar-page.constants";
import type { CalendarPeriodCell } from "./model/calendar-page.types";
import "./components/CalendarDayCell.css";
import "./components/CalendarViewTransition.css";
import "./CalendarPage.css";

type CalendarPageProps = {
  initialDate?: string | null;
  userRole: string | null;
};

export function CalendarPage({ initialDate, userRole }: CalendarPageProps) {
  const canView = canViewCalendar(userRole);

  if (!canView) {
    return (
      <section className="calendar-page">
        <Notice tone="error">Недостаточно прав для просмотра календаря.</Notice>
      </section>
    );
  }

  return <CalendarView initialDate={initialDate} />;
}

function CalendarView({ initialDate }: { initialDate?: string | null }) {
  const calendar = useCalendarMonth(initialDate);
  const [modalDay, setModalDay] = useState<CalendarPeriodCell | null>(null);
  const setCalendarViewMode = calendar.setViewMode;
  const resetCalendarView = useCallback(() => {
    setCalendarViewMode("month");
  }, [setCalendarViewMode]);
  const { zoomAnimation } = useCalendarZoom({
    onReset: resetCalendarView,
    onZoom: calendar.zoomView,
    viewMode: calendar.viewMode,
  });

  const handleDaySelect = (cell: CalendarPeriodCell) => {
    calendar.selectDay(cell.dateId);
  };

  const handleDayOpen = (cell: CalendarPeriodCell) => {
    calendar.selectDay(cell.dateId);
    setModalDay(cell);
  };

  const handleEventOpen = (event: CalendarLayerItemDto, dateId: string) => {
    openCalendarNavigation(event.navigation, {
      returnTo: buildHashRoute("#/calendar", {
        date: dateId,
      }),
    });
  };

  return (
    <section className="calendar-page">
      <header className="calendar-page-header">
        <h1>Календарь</h1>

        <div className="calendar-page-toolbar">
          <div className="calendar-month-switcher" aria-label="Выбор периода">
            <button
              aria-label="Предыдущий период"
              onClick={calendar.goToPreviousPeriod}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <span>{calendar.period.title}</span>
            <button
              aria-label="Следующий период"
              onClick={calendar.goToNextPeriod}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </header>

      {calendar.error ? <Notice tone="error">{calendar.error}</Notice> : null}

      <section
        aria-busy={calendar.isLoading}
        aria-label={calendar.period.title}
        className={[
          "calendar-month-card",
          calendar.isLoading ? "loading" : "",
          zoomAnimation ? `zoom-${zoomAnimation}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="calendar-weekdays" aria-hidden="true">
          {CALENDAR_WEEKDAY_LABELS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div
          className={`calendar-month-grid calendar-${calendar.viewMode}-grid`}
        >
          {calendar.period.cells.map((cell) => (
            <CalendarDayCell
              cell={cell}
              isSelected={cell.dateId === calendar.selectedDateId}
              key={cell.dateId}
              onEventOpen={handleEventOpen}
              onOpenDay={handleDayOpen}
              onSelect={handleDaySelect}
            />
          ))}
        </div>
      </section>

      {modalDay ? (
        <DayEventsModal
          day={
            calendar.selectedDay?.dateId === modalDay.dateId
              ? calendar.selectedDay
              : modalDay
          }
          onClose={() => setModalDay(null)}
          onEventOpen={handleEventOpen}
        />
      ) : null}
    </section>
  );
}
