import { render, position } from "./stock-page-test-context";
import { WarehouseStockTable } from "./WarehouseStockTable";
import { WarehouseStockCards } from "./WarehouseStockCards";
import { act, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { StockPosition } from "../../shared/api/warehouse-stock-api";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(["table", "cards"])(
  "windows 50,000 loaded %s entries and unmounts rows outside the viewport",
  (mode) => {
    let offset = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const grid =
          this.tagName === "TBODY" || this.classList.contains("stock-cards");
        return {
          x: 0,
          y: grid ? -offset : 0,
          top: grid ? -offset : 0,
          bottom: grid ? 2400000 - offset : 48,
          left: 0,
          right: 1200,
          width: 1200,
          height: grid ? 2400000 : 48,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    const rows: StockPosition[] = Array.from({ length: 50000 }, (_, i) => ({
      ...position,
      id: `${i}:${position.warehouse.id}`,
      item: {
        ...position.item,
        id: String(i + 1),
        article: `ART-${String(i).padStart(5, "0")}`,
        name: `Позиция ${i}`,
      },
    }));
    render(
      mode === "table" ? (
        <WarehouseStockTable
          rows={rows}
          sort={{ key: "article", direction: "asc" }}
          onSort={vi.fn()}
          onOpen={vi.fn()}
          disabled={false}
        />
      ) : (
        <WarehouseStockCards rows={rows} onOpen={vi.fn()} disabled={false} />
      ),
    );
    const count = () =>
      screen.getAllByRole(mode === "table" ? "row" : "listitem").length;
    expect(screen.getByText("ART-00000")).toBeTruthy();
    expect(count()).toBeLessThan(200);
    offset = 24000;
    act(() => window.dispatchEvent(new Event("scroll")));
    expect(screen.queryByText("ART-00000")).toBeNull();
    expect(screen.getByText("ART-00500")).toBeTruthy();
    expect(count()).toBeLessThan(200);
    offset = 0;
    act(() => window.dispatchEvent(new Event("scroll")));
    expect(screen.getByText("ART-00000")).toBeTruthy();
    expect(screen.queryByText("ART-00500")).toBeNull();
    if (mode === "table") {
      expect(screen.queryByRole("columnheader", { name: "Ед." })).toBeNull();
      expect(screen.getAllByText("17,001 шт").length).toBeGreaterThan(0);
    }
  },
);
