import { canManageProductionCalendar } from "../../shared/lib/roles";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { DayEditModal } from "./components/DayEditModal";
import { MonthCalendar } from "./components/MonthCalendar";
import { YearSwitcher } from "./components/YearSwitcher";
import { useProductionCalendar } from "./hooks/useProductionCalendar";
import type { ProductionCalendarPageProps } from "./model/types";
import "./ProductionCalendarPage.css";

export function ProductionCalendarPage({
  userRole,
}: ProductionCalendarPageProps) {
  const isAdmin = canManageProductionCalendar(userRole);
  const calendar = useProductionCalendar();

  if (!isAdmin) {
    return (
      <section className="admin-page production-calendar-page">
        <Notice tone="error">
          Недостаточно прав для управления производственным календарём.
        </Notice>
      </section>
    );
  }

  return (
    <section className="admin-page production-calendar-page">
      <header className="admin-page-header production-calendar-header">
        <h1>Производственный календарь</h1>

        <YearSwitcher
          canGoToNextYear={calendar.canGoToNextYear}
          canGoToPreviousYear={calendar.canGoToPreviousYear}
          onNextYear={calendar.goToNextYear}
          onPreviousYear={calendar.goToPreviousYear}
          year={calendar.year}
        />
      </header>

      <section className="admin-card production-calendar-card">
        <div className="production-calendar-year-grid">
          {calendar.months.map((month) => (
            <MonthCalendar
              key={month.monthIndex}
              month={month}
              onSelectDay={calendar.selectDay}
            />
          ))}
        </div>
      </section>

      {calendar.selectedDay ? (
        <DayEditModal
          day={calendar.selectedDay}
          onClose={calendar.closeSelectedDay}
          onReset={calendar.resetDay}
          onSave={calendar.saveDay}
        />
      ) : null}
    </section>
  );
}
