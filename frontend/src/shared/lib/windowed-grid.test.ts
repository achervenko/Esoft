import { expect, it } from "vitest";
import { getGridWindow, type GridLayout } from "./windowed-grid";
const layout: GridLayout = {
  columns: 3,
  gap: 18,
  estimatedHeight: 400,
  rowHeights: {},
  scrollTop: 0,
  viewportHeight: 800,
};
it("bounds mounted cards while preserving the complete list height", () => {
  const middle = getGridWindow(4003, { ...layout, scrollTop: 418 * 500 });
  expect(middle.start).toBe((500 - 33) * 3);
  expect(middle.end - middle.start).toBeLessThan(160);
  const renderedRows = Math.ceil((middle.end - middle.start) / 3);
  const actual =
    middle.before + middle.after + renderedRows * 400 + (renderedRows + 1) * 18;
  expect(actual).toBe(Math.ceil(4003 / 3) * 418 - 18);
});
it("renders the beginning and end without missing or duplicating items", () => {
  expect(getGridWindow(4003, layout).start).toBe(0);
  const end = getGridWindow(4003, { ...layout, scrollTop: 1e9 });
  expect(end.end).toBe(4003);
  expect(end.after).toBe(0);
  expect(end.end - end.start).toBeLessThanOrEqual(103);
  expect(getGridWindow(0, layout)).toMatchObject({
    start: 0,
    end: 0,
    before: 0,
    after: 0,
  });
});
it("accounts for measured row heights and responsive column counts", () => {
  const measured = getGridWindow(4003, {
    ...layout,
    rowHeights: { 0: 600 },
    scrollTop: 418 * 500 + 200,
  });
  const estimated = getGridWindow(4003, { ...layout, scrollTop: 418 * 500 });
  expect(measured.start).toBe(estimated.start);
  expect(measured.before).toBe(estimated.before + 200);
  const mobile = getGridWindow(4003, {
    ...layout,
    columns: 1,
    scrollTop: 418 * 1000,
  });
  expect(mobile.start).toBe(900);
  expect(mobile.end - mobile.start).toBeLessThan(160);
});
