import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { getCalendar, type CalendarDto } from "../../../shared/api/calendar";
import type {
  CalendarViewMode,
  CalendarZoomDirection,
} from "../model/calendar-page.types";
import {
  createCalendarMonth,
  createCalendarWeek,
  createMonthDate,
  formatDateId,
  getCalendarZoomViewMode,
  getMonthRequestRange,
  getNextMonth,
  getNextWeek,
  getPreviousMonth,
  getPreviousWeek,
  getWeekRequestRange,
  isValidDateId,
  parseDateId,
  setMonthAndYear,
} from "../model/calendar-page.utils";

export function useCalendarMonth(initialDateId?: string | null) {
  const syncedInitialDateIdRef = useRef(initialDateId);
  const [visibleDate, setVisibleDate] = useState(() => {
    const initialDate = getInitialCalendarDate(initialDateId);
    return createMonthDate(initialDate.getFullYear(), initialDate.getMonth());
  });
  const [selectedDateId, setSelectedDateId] = useState(() =>
    formatDateId(getInitialCalendarDate(initialDateId)),
  );
  const [viewMode, setViewModeState] = useState<CalendarViewMode>("month");
  const [calendar, setCalendar] = useState<CalendarDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const range = useMemo(() => {
    return viewMode === "month"
      ? getMonthRequestRange(visibleDate)
      : getWeekRequestRange(visibleDate);
  }, [viewMode, visibleDate]);

  const period = useMemo(() => {
    return viewMode === "month"
      ? createCalendarMonth(visibleDate, calendar)
      : createCalendarWeek(visibleDate, calendar);
  }, [calendar, viewMode, visibleDate]);

  const selectedDay = useMemo(() => {
    return period.cells.find((cell) => cell.dateId === selectedDateId) ?? null;
  }, [period.cells, selectedDateId]);

  const zoomView = useCallback(
    (direction: CalendarZoomDirection) => {
      setViewModeState((currentMode) => {
        const nextMode = getCalendarZoomViewMode(currentMode, direction);

        if (nextMode !== currentMode) {
          setVisibleDate(parseDateId(selectedDateId));
        }

        return nextMode;
      });
    },
    [selectedDateId],
  );

  const setViewMode = useCallback(
    (mode: CalendarViewMode) => {
      setViewModeState(mode);
      setVisibleDate(parseDateId(selectedDateId));
    },
    [selectedDateId],
  );

  useEffect(() => {
    if (syncedInitialDateIdRef.current === initialDateId) {
      return;
    }

    syncedInitialDateIdRef.current = initialDateId;

    if (!isValidDateId(initialDateId)) {
      return;
    }

    const initialDate = parseDateId(initialDateId);
    setSelectedDateId(initialDateId);
    setVisibleDate(
      viewMode === "month"
        ? createMonthDate(initialDate.getFullYear(), initialDate.getMonth())
        : initialDate,
    );
  }, [initialDateId, viewMode]);

  useEffect(() => {
    const abortController = new AbortController();

    setIsLoading(true);
    setError(null);

    getCalendar({
      from: range.dateFrom,
      to: range.dateTo,
    })
      .then((result) => {
        if (!abortController.signal.aborted) {
          setCalendar(result);
        }
      })
      .catch((requestError) => {
        if (!abortController.signal.aborted) {
          setCalendar(null);
          setError(
            getApiErrorMessage(requestError, "Не удалось загрузить календарь."),
          );
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => abortController.abort();
  }, [range.dateFrom, range.dateTo]);

  return {
    error,
    isLoading,
    period,
    selectedDateId,
    selectedDay,
    viewMode,
    goToNextPeriod: () =>
      setVisibleDate((value) =>
        viewMode === "month" ? getNextMonth(value) : getNextWeek(value),
      ),
    goToPreviousPeriod: () =>
      setVisibleDate((value) =>
        viewMode === "month" ? getPreviousMonth(value) : getPreviousWeek(value),
      ),
    goToMonth: (month: number) =>
      setVisibleDate((value) => setMonthAndYear(value, { month })),
    goToYear: (year: number) =>
      setVisibleDate((value) => setMonthAndYear(value, { year })),
    selectDay: (dateId: string) => {
      if (isValidDateId(dateId)) {
        setSelectedDateId(dateId);
      }
    },
    setViewMode,
    zoomView,
  };
}

function getInitialCalendarDate(initialDateId: string | null | undefined) {
  return isValidDateId(initialDateId) ? parseDateId(initialDateId) : new Date();
}
