import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarDto } from "../../../shared/api/calendar";
import {
  createCalendarMonth,
  createCalendarWeek,
  createMonthDate,
  formatDateId,
  getCalendarZoomViewMode,
  getNextMonth,
  getMonthRequestRange,
  getPreviousMonth,
  getWeekRequestRange,
  isValidDateId,
} from "./calendar-page.utils";

describe("calendar-page utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates month grid with previous and next month days", () => {
    const range = getMonthRequestRange(createMonthDate(2027, 2));

    expect(range).toEqual({
      dateFrom: "2027-03-01",
      dateTo: "2027-04-04",
    });
  });

  it("moves between months across year boundary", () => {
    expect(formatDateId(getNextMonth(createMonthDate(2027, 11)))).toBe(
      "2028-01-01",
    );
    expect(formatDateId(getPreviousMonth(createMonthDate(2027, 0)))).toBe(
      "2026-12-01",
    );
  });

  it("creates month without calendar data", () => {
    const month = createCalendarMonth(createMonthDate(2027, 2), null);

    expect(month.cells).toHaveLength(35);
    expect(month.cells.every((cell) => cell.day === null)).toBe(true);
    expect(month.cells.every((cell) => cell.events.length === 0)).toBe(true);
  });

  it("marks neighbouring month days as outside month in month view", () => {
    const month = createCalendarMonth(createMonthDate(2027, 2), null);

    expect(month.cells[0].dateId).toBe("2027-03-01");
    expect(month.cells.at(-1)?.dateId).toBe("2027-04-04");
    expect(month.cells.at(-1)?.isPrimaryPeriod).toBe(false);
  });

  it("creates week from the same calendar cell model", () => {
    const week = createCalendarWeek(new Date(2027, 2, 17), null);

    expect(week.cells).toHaveLength(7);
    expect(week.dateFrom).toBe("2027-03-15");
    expect(week.dateTo).toBe("2027-03-21");
    expect(week.cells[0].dateId).toBe("2027-03-15");
    expect(week.cells[6].dateId).toBe("2027-03-21");
  });

  it("treats all week days as current period even across months", () => {
    const week = createCalendarWeek(new Date(2027, 2, 31), null);

    expect(week.cells).toHaveLength(7);
    expect(week.cells.every((cell) => cell.isPrimaryPeriod)).toBe(true);
  });

  it("adds years to week title when week crosses year boundary", () => {
    const week = createCalendarWeek(new Date(2027, 11, 31), null);

    expect(week.title).toBe("27.12.2027 - 02.01.2028");
  });

  it("gets week request range", () => {
    expect(getWeekRequestRange(new Date(2027, 2, 21))).toEqual({
      dateFrom: "2027-03-15",
      dateTo: "2027-03-21",
    });
  });

  it("zooms between currently supported calendar views", () => {
    expect(getCalendarZoomViewMode("month", "in")).toBe("week");
    expect(getCalendarZoomViewMode("week", "out")).toBe("month");
    expect(getCalendarZoomViewMode("week", "in")).toBe("week");
    expect(getCalendarZoomViewMode("month", "out")).toBe("month");
  });

  it("creates month with empty calendar data", () => {
    const month = createCalendarMonth(createMonthDate(2027, 2), {
      days: [],
      layers: [],
    });

    expect(month.cells).toHaveLength(35);
    expect(month.cells.every((cell) => cell.day === null)).toBe(true);
    expect(month.cells.every((cell) => cell.events.length === 0)).toBe(true);
  });

  it("groups calendar items by displayDate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 2, 15, 12));

    const calendar: CalendarDto = {
      days: [
        {
          comment: null,
          date: "2027-03-15",
          isManual: false,
          type: "WORKING",
        },
      ],
      layers: [
        {
          code: "EVENTS",
          title: "События",
          items: [
            {
              displayDate: "2027-03-15",
              id: "event-1",
              source: "EQUIPMENT",
              title: "Событие 1",
            },
            {
              displayDate: "2027-03-15",
              id: "event-2",
              source: "EQUIPMENT",
              title: "Событие 2",
            },
          ],
        },
      ],
    };

    const month = createCalendarMonth(createMonthDate(2027, 2), calendar);
    const targetCell = month.cells.find((cell) => cell.dateId === "2027-03-15");

    expect(targetCell?.events).toHaveLength(2);
    expect(targetCell?.isToday).toBe(true);
  });

  it("formats dates without UTC shifting", () => {
    expect(formatDateId(new Date(2027, 0, 1, 23))).toBe("2027-01-01");
  });

  it("validates date ids strictly", () => {
    expect(isValidDateId("2027-03-15")).toBe(true);
    expect(isValidDateId("2027-02-30")).toBe(false);
    expect(isValidDateId("2027-3-15")).toBe(false);
    expect(isValidDateId(null)).toBe(false);
  });

  it("validates leap year dates correctly", () => {
    expect(isValidDateId("2028-02-29")).toBe(true);
    expect(isValidDateId("2027-02-29")).toBe(false);
  });

  it("shows calendar items even when day metadata is missing", () => {
    const calendar: CalendarDto = {
      days: [],
      layers: [
        {
          code: "EVENTS",
          title: "События",
          items: [
            {
              displayDate: "2027-03-15",
              id: "event-1",
              source: "EQUIPMENT",
              title: "Событие",
            },
          ],
        },
      ],
    };

    const month = createCalendarMonth(createMonthDate(2027, 2), calendar);
    const cell = month.cells.find((item) => item.dateId === "2027-03-15");

    expect(cell?.day).toBeNull();
    expect(cell?.events).toHaveLength(1);
  });
});
