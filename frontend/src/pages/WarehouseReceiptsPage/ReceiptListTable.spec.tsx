import { afterEach, expect, it, vi } from "vitest";
import { cleanup, screen, fireEvent, act } from "@testing-library/react";
import { render } from "./receipts-test-render";
import { ReceiptListTable } from "./ReceiptListTable";
import { receipt } from "./receipts-test-context";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([
  ["2026-10-30T22:00:00Z", "2026-10-30T20:49:00Z", "23:49", "Вчера"],
  ["2026-10-30T22:00:00Z", "2026-10-29T12:00:00Z", "29.10.2026", "15:00"],
  ["2026-12-31T22:00:00Z", "2026-12-31T10:00:00Z", "13:00", "Вчера"],
  ["2026-12-31T22:00:00Z", "2026-12-30T10:00:00Z", "30.12.2026", "13:00"],
])(
  "prioritizes date or time by Moscow calendar days: %s / %s",
  (now, receivedAt, primary, secondary) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { container } = render(
      <ReceiptListTable
        items={[{ ...receipt, receivedAt }]}
        onOpen={vi.fn()}
      />,
    );
    const time = container.querySelector("time")!;
    expect(time.querySelector("span")).toHaveTextContent(primary);
    expect(time.querySelector("small")).toHaveTextContent(secondary);
    expect(time).toHaveAttribute("dateTime", receivedAt);
  },
);
it("shows quantity progress and splits the received date using Moscow time", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T22:00:00Z"));
  render(
    <ReceiptListTable
      items={[
        {
          ...receipt,
          receivedAt: "2026-10-30T21:49:00Z",
          lineCount: 2,
          placedLineCount: 0,
          totalQuantity: "50",
          placedQuantity: "2",
        },
      ]}
      onOpen={vi.fn()}
    />,
  );
  expect(screen.getByText("2 из 50")).toBeInTheDocument();
  expect(screen.getByText("4%")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  expect(screen.getByText("00:49")).toBeInTheDocument();
  expect(screen.getByText("Сегодня")).toBeInTheDocument();
  expect(screen.getByText("1С").tagName).toBe("SMALL");
});
it("sorts the received column by receipt time rather than creation time", () => {
  const onSortChange = vi.fn();
  render(
    <ReceiptListTable
      items={[receipt]}
      onOpen={vi.fn()}
      onSortChange={onSortChange}
    />,
  );
  expect(screen.getByRole("time")).toHaveAttribute(
    "dateTime",
    receipt.receivedAt,
  );
  fireEvent.click(screen.getByRole("button", { name: /Получен/ }));
  expect(onSortChange).toHaveBeenCalledWith({
    key: "receivedAt",
    direction: "asc",
  });
});
it("retains conflict visibility and handles an empty receipt without invalid progress", () => {
  render(
    <ReceiptListTable
      items={[
        {
          ...receipt,
          totalQuantity: "0",
          placedQuantity: "0",
          lineCount: 0,
          placedLineCount: 0,
          conflict: "SOURCE_LINES_CHANGED_AFTER_PLACEMENT",
          hasProblems: true,
        },
      ]}
      onOpen={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("columnheader", { name: "Состояние" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("0 из 0")).toBeInTheDocument();
  expect(screen.getByText("Конфликт 1С").closest("tr")).toHaveClass(
    "receipt-conflict-row",
  );
  expect(screen.getByText("0%")).toBeInTheDocument();
});
it("does not repeat date formatting when unchanged rows render again", () => {
  const props = { items: [receipt], onOpen: vi.fn() };
  const view = render(<ReceiptListTable {...props} />);
  const formatter = vi.spyOn(Intl, "DateTimeFormat");
  view.rerender(<ReceiptListTable {...props} />);
  // Only the current business day is read; each unchanged row reuses its date cell.
  expect(formatter).toHaveBeenCalledTimes(1);
  formatter.mockRestore();
});

it("marks mapping problems yellow and possible manual receipts blue", () => {
  render(
    <ReceiptListTable
      items={[
        { ...receipt, id: "warning", warehouseId: null, unmappedLineCount: 2 },
        { ...receipt, id: "info", hasReconciliationCandidates: true },
      ]}
      onOpen={vi.fn()}
    />,
  );
  expect(screen.getByText("Склад не сопоставлен").closest("tr")).toHaveClass(
    "receipt-warning-row",
  );
  expect(screen.getByText("Сопоставьте товары: 2")).toBeInTheDocument();
  expect(
    screen.getByText("Возможно, уже принято вручную").closest("tr"),
  ).toHaveClass("receipt-info-row");
});

it("uses windowed clickable cards only on narrow screens with the same metrics and notices", () => {
  let width = 640;
  let measure: () => void = () => {};
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({
      width,
      height: 100,
      top: 0,
      left: 0,
      right: width,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe(element: HTMLElement) {
        if (element.classList.contains("receipt-list-layout"))
          measure = this.callback;
      }
      unobserve() {}
      disconnect() {}
    },
  );
  const onOpen = vi.fn();
  const items = Array.from({ length: 500 }, (_, i) => ({
    ...receipt,
    id: String(i),
    conflict: i === 0 ? "SOURCE_LINES_CHANGED_AFTER_PLACEMENT" : null,
  }));
  const view = render(<ReceiptListTable items={items} onOpen={onOpen} />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Приходы" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").length).toBeLessThan(100);
  expect(screen.getAllByText("4 из 10")[0]).toBeInTheDocument();
  expect(screen.getByText("Конфликт 1С")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button")[0]);
  expect(onOpen).toHaveBeenCalledWith("0");
  width = 900;
  act(() => measure());
  view.rerender(<ReceiptListTable items={items} onOpen={onOpen} />);
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(
    screen.queryByRole("list", { name: "Приходы" }),
  ).not.toBeInTheDocument();
});
