import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  getCalendarRange,
  updateCalendarWorkday,
  type CalendarWorkdayDto,
  type CalendarWorkdayUpdatePayload,
} from "../../../shared/api/calendar";
import {
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
} from "../model/constants";
import {
  clampCalendarYear,
  createDefaultYearDays,
  createMonths,
  getDefaultDayType,
} from "../model/calendar.utils";
import type { CalendarDayDraft, CalendarDayState, DayType } from "../model/types";

const DEFAULT_WORKING_HOURS = 8;

export function useProductionCalendar() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(clampCalendarYear(currentYear));
  const [daysByYear, setDaysByYear] = useState<
    Record<number, Record<string, CalendarDayState>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const daysById = useMemo(() => {
    return daysByYear[year] ?? createDefaultYearDays(year);
  }, [daysByYear, year]);
  const months = useMemo(() => createMonths(year, daysById), [daysById, year]);
  const selectedDay = selectedDayId ? daysById[selectedDayId] ?? null : null;

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);
    setSelectedDayId(null);

    getCalendarRange({
      dateFrom: `${year}-01-01`,
      dateTo: `${year}-12-31`,
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setDaysByYear((current) => ({
          ...current,
          [year]: mapCalendarDays(response.days),
        }));
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(
            getApiErrorMessage(
              requestError,
              "Не удалось загрузить производственный календарь.",
            ),
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [year]);

  const saveDay = async (
    day: CalendarDayState,
    draft: CalendarDayDraft,
  ): Promise<void> => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedDay = await updateCalendarWorkday(
        buildWorkdayUpdatePayload(day.id, draft),
      );

      applyUpdatedDay(updatedDay);
      setSelectedDayId(null);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Не удалось сохранить производственный день.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetDay = async (day: CalendarDayState): Promise<void> => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedDay = await updateCalendarWorkday(
        buildResetWorkdayPayload(day),
      );

      applyUpdatedDay(updatedDay);
      setSelectedDayId(null);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Не удалось вернуть день по умолчанию.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
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
    error,
    goToNextYear,
    goToPreviousYear,
    isLoading,
    isSaving,
    months,
    resetDay,
    saveDay,
    selectedDay,
    selectDay: setSelectedDayId,
    year,
  };

  function applyUpdatedDay(day: CalendarWorkdayDto): void {
    const targetYear = getYearFromDateId(day.date);

    setDaysByYear((current) => ({
      ...current,
      [targetYear]: {
        ...(current[targetYear] ?? {}),
        [day.date]: mapCalendarDay(day),
      },
    }));
  }
}

function mapCalendarDays(
  days: CalendarWorkdayDto[],
): Record<string, CalendarDayState> {
  return Object.fromEntries(days.map((day) => [day.date, mapCalendarDay(day)]));
}

function mapCalendarDay(day: CalendarWorkdayDto): CalendarDayState {
  return {
    comment: day.holidayName ?? "",
    date: parseDateId(day.date),
    id: day.date,
    isManual: day.source !== "SYSTEM",
    type: resolveDayType(day),
  };
}

function resolveDayType(day: CalendarWorkdayDto): DayType {
  if (day.isHoliday) {
    return "holiday";
  }

  if (day.isPreholiday) {
    return "shortened";
  }

  return day.isWorkingDay ? "working" : "weekend";
}

function buildWorkdayUpdatePayload(
  date: string,
  draft: CalendarDayDraft,
): CalendarWorkdayUpdatePayload {
  const comment = draft.comment.trim() || null;

  switch (draft.type) {
    case "working":
      return {
        date,
        holidayName: comment,
        isHoliday: false,
        isPreholiday: false,
        isWorkingDay: true,
      };
    case "weekend":
      return {
        date,
        holidayName: comment,
        isHoliday: false,
        isPreholiday: false,
        isWorkingDay: false,
        workingHours: 0,
      };
    case "holiday":
      return {
        date,
        holidayName: comment,
        isHoliday: true,
        isPreholiday: false,
        isWorkingDay: false,
        workingHours: 0,
      };
    case "shortened":
      return {
        date,
        holidayName: comment,
        isHoliday: false,
        isPreholiday: true,
        isWorkingDay: true,
      };
  }
}

function buildResetWorkdayPayload(
  day: CalendarDayState,
): CalendarWorkdayUpdatePayload {
  const isWorkingDay = getDefaultDayType(day.date) === "working";

  return {
    date: day.id,
    holidayName: null,
    isHoliday: false,
    isPreholiday: false,
    isWorkingDay,
    workingHours: isWorkingDay ? DEFAULT_WORKING_HOURS : 0,
  };
}

function parseDateId(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function getYearFromDateId(value: string): number {
  return Number(value.slice(0, 4));
}
