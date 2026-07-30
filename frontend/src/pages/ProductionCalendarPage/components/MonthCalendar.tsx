import { DAY_TYPE_LABELS, WEEKDAY_LABELS } from "../model/constants";
import { formatLongDate, isToday } from "../model/calendar.utils";
import type { MonthModel } from "../model/types";
import "./MonthCalendar.css";

type MonthCalendarProps = {
  month: MonthModel;
  onSelectDay: (dayId: string) => void;
};

export function MonthCalendar({
  month,
  onSelectDay,
}: MonthCalendarProps) {
  return (
    <section className="production-calendar-month" aria-label={month.title}>
      <h3>{month.title}</h3>
      <div className="production-calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="production-calendar-days">
        {month.days.map((day, index) =>
          day ? (
            <button
              aria-label={`${formatLongDate(day.date)}. ${DAY_TYPE_LABELS[day.type]}`}
              className={[
                "production-calendar-day",
                day.type,
                day.isManual ? "manual" : "",
                isToday(day.date) ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={day.id}
              onClick={() => onSelectDay(day.id)}
              title={day.comment || DAY_TYPE_LABELS[day.type]}
              type="button"
            >
              <span>{day.date.getDate()}</span>
            </button>
          ) : (
            <span
              aria-hidden="true"
              className="production-calendar-day-placeholder"
              key={`empty-${month.monthIndex}-${index}`}
            />
          ),
        )}
      </div>
    </section>
  );
}
