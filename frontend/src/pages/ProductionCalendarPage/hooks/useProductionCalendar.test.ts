import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../../shared/api/calendar";
import { useProductionCalendar } from "./useProductionCalendar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  ["SYSTEM", false],
  ["IMPORT", false],
  ["MANUAL", true],
] as const)("marks %s days as manual only when appropriate", async (source, isManual) => {
  const loaded = day({ source });
  vi.spyOn(api, "getCalendarRange").mockResolvedValue({ days: [loaded] });
  const hook = renderHook(useProductionCalendar);
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  act(() => hook.result.current.selectDay(loaded.date));
  expect(hook.result.current.selectedDay?.isManual).toBe(isManual);
});
function day(
  overrides: Partial<api.CalendarWorkdayDto> = {},
): api.CalendarWorkdayDto {
  return {
    date: `${new Date().getFullYear()}-08-03`,
    day: 3,
    dayOfWeek: 1,
    dayOfYear: 215,
    holidayName: "Изменён",
    isHoliday: false,
    isPreholiday: true,
    isWorkingDay: true,
    isoWeekYear: new Date().getFullYear(),
    month: 8,
    quarter: 3,
    source: "MANUAL",
    week: 32,
    workingHours: 7,
    year: new Date().getFullYear(),
    ...overrides,
  };
}

it("sets 8 and 7 hours when changing between working and shortened days", async () => {
  const original = day();
  vi.spyOn(api, "getCalendarRange").mockResolvedValue({ days: [original] });
  const update = vi
    .spyOn(api, "updateCalendarWorkday")
    .mockResolvedValue(original);
  const hook = renderHook(useProductionCalendar);
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  act(() => hook.result.current.selectDay(original.date));
  const selected = hook.result.current.selectedDay!;
  await act(() =>
    hook.result.current.saveDay(selected, { type: "working", comment: "" }),
  );
  expect(update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      isWorkingDay: true,
      isPreholiday: false,
      workingHours: 8,
    }),
  );
  await act(() =>
    hook.result.current.saveDay(selected, { type: "shortened", comment: "" }),
  );
  expect(update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      isWorkingDay: true,
      isPreholiday: true,
      workingHours: 7,
    }),
  );
});

it("uses the reset operation and removes the manual marker from server data", async () => {
  const original = day();
  vi.spyOn(api, "getCalendarRange").mockResolvedValue({ days: [original] });
  const update = vi.spyOn(api, "updateCalendarWorkday");
  const reset = vi
    .spyOn(api, "resetCalendarWorkday")
    .mockResolvedValue(
      day({
        source: "SYSTEM",
        isPreholiday: false,
        holidayName: null,
        workingHours: 8,
      }),
    );
  const hook = renderHook(useProductionCalendar);
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  act(() => hook.result.current.selectDay(original.date));
  expect(hook.result.current.selectedDay?.isManual).toBe(true);
  await act(() =>
    hook.result.current.resetDay(hook.result.current.selectedDay!),
  );
  expect(reset).toHaveBeenCalledExactlyOnceWith(original.date);
  expect(update).not.toHaveBeenCalled();
  act(() => hook.result.current.selectDay(original.date));
  expect(hook.result.current.selectedDay).toMatchObject({
    isManual: false,
    type: "working",
    comment: "",
  });
});
