import { useMemo, useState } from "react";
import {
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
} from "../model/constants";
import {
  clampCalendarYear,
  createDefaultYearDays,
  createMonths,
} from "../model/calendar.utils";
import type { CalendarDayDraft, CalendarDayState } from "../model/types";

export function useProductionCalendar() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(clampCalendarYear(currentYear));
  const defaultDays = useMemo(() => createDefaultYearDays(year), [year]);
  const [overridesByYear, setOverridesByYear] = useState<
    Record<number, Record<string, CalendarDayState>>
  >({});
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const daysById = useMemo(
    () => ({
      ...defaultDays,
      ...(overridesByYear[year] ?? {}),
    }),
    [defaultDays, overridesByYear, year],
  );
  const months = useMemo(() => createMonths(year, daysById), [daysById, year]);
  const selectedDay = selectedDayId ? daysById[selectedDayId] ?? null : null;

  const saveDay = (day: CalendarDayState, draft: CalendarDayDraft) => {
    const defaultDay = defaultDays[day.id];
    const isManual =
      draft.type !== defaultDay.type || draft.comment.trim() !== "";

    setOverridesByYear((current) => ({
      ...current,
      [year]: {
        ...(current[year] ?? {}),
        [day.id]: {
          ...day,
          comment: draft.comment.trim(),
          isManual,
          type: draft.type,
        },
      },
    }));
    setSelectedDayId(null);
  };

  const resetDay = (day: CalendarDayState) => {
    setOverridesByYear((current) => {
      const yearOverrides = { ...(current[year] ?? {}) };

      delete yearOverrides[day.id];

      return {
        ...current,
        [year]: yearOverrides,
      };
    });
    setSelectedDayId(null);
  };

  const goToPreviousYear = () => {
    setYear((value) => Math.max(MIN_CALENDAR_YEAR, value - 1));
  };

  const goToNextYear = () => {
    setYear((value) => Math.min(MAX_CALENDAR_YEAR, value + 1));
  };

  return {
    canGoToNextYear: year < MAX_CALENDAR_YEAR,
    canGoToPreviousYear: year > MIN_CALENDAR_YEAR,
    closeSelectedDay: () => setSelectedDayId(null),
    goToNextYear,
    goToPreviousYear,
    months,
    resetDay,
    saveDay,
    selectedDay,
    selectDay: setSelectedDayId,
    year,
  };
}
