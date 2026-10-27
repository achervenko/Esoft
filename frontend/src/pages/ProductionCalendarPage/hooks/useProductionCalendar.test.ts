import { getBusinessTodayDateString } from "../../../shared/lib/business-date";
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
] as const)(
  "marks %s days as manual only when appropriate",
  async (source, isManual) => {
    const loaded = day({ source });
    vi.spyOn(api, "getCalendarRange").mockResolvedValue({ days: [loaded] });
    const hook = renderHook(useProductionCalendar);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.selectDay(loaded.date));
    expect(hook.result.current.selectedDay?.isManual).toBe(isManual);
  },
);
function day(
  overrides: Partial<api.CalendarWorkdayDto> = {},
): api.CalendarWorkdayDto {
  const currentYear = Number(getBusinessTodayDateString().slice(0, 4));
  return {
    date: `${currentYear}-08-03`,
    day: 3,
    dayOfWeek: 1,
    dayOfYear: 215,
    holidayName: "Изменён",
    isHoliday: false,
    isPreholiday: true,
    isWorkingDay: true,
    isoWeekYear: currentYear,
    month: 8,
    quarter: 3,
    source: "MANUAL",
    week: 32,
    workingHours: 7,
    year: currentYear,
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
  const reset = vi.spyOn(api, "resetCalendarWorkday").mockResolvedValue(
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

it.each([
  ["save", false],
  ["reset", false],
  ["save", true],
  ["reset", true],
] as const)(
  "blocks same-render duplicates during %s and unlocks after rejection=%s",
  async (operation, rejects) => {
    const original = day();
    vi.spyOn(api, "getCalendarRange").mockResolvedValue({ days: [original] });
    const update = vi
      .spyOn(api, "updateCalendarWorkday")
      .mockResolvedValue(original);
    const reset = vi
      .spyOn(api, "resetCalendarWorkday")
      .mockResolvedValue(original);
    let resolve!: (value: api.CalendarWorkdayDto) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<api.CalendarWorkdayDto>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    (operation === "save" ? update : reset).mockReturnValueOnce(pending);
    const hook = renderHook(useProductionCalendar);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.selectDay(original.date));
    const actions = hook.result.current;
    const selected = actions.selectedDay!;
    const save = () =>
      actions.saveDay(selected, { type: "working", comment: "" });
    const restore = () => actions.resetDay(selected);
    let request!: Promise<void>;
    act(() => {
      request = operation === "save" ? save() : restore();
      void save();
      void restore();
    });
    expect(update).toHaveBeenCalledTimes(operation === "save" ? 1 : 0);
    expect(reset).toHaveBeenCalledTimes(operation === "reset" ? 1 : 0);
    expect(hook.result.current.isSaving).toBe(true);
    await act(async () => {
      if (rejects) reject(new Error("Network failure"));
      else resolve(original);
      await request;
    });
    expect(hook.result.current.isSaving).toBe(false);
    await act(async () => {
      await (operation === "save" ? restore() : save());
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  },
);
