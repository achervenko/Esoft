import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { OrderData } from "../../shared/api/orders-api";
import { OrdersListCards } from "./OrdersListCards";
import "./OrdersPage.css";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("windows 50,000 orders and removes cards outside the viewport", () => {
  let offset = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const grid = this.classList.contains("orders-list");
      return {
        x: 0,
        y: grid ? -offset : 0,
        top: grid ? -offset : 0,
        bottom: 76,
        left: 0,
        right: 1200,
        width: 1200,
        height: 76,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
  const items: OrderData[] = Array.from({ length: 50000 }, (_, index) => ({
    id: String(index),
    sourceId: "source",
    externalId: null,
    number: `ORDER-${index}`,
    name: "",
    status: "Закрыт",
    posted: true,
    deletionMark: false,
    missingChecks: 0,
    documentDate: "2026-11-07T00:00:00",
    checkedAt: "2026-11-07T00:00:00Z",
    changedAt: "2026-11-07T00:00:00Z",
    source: { name: "1С" },
  }));
  render(
    <ChakraProvider value={defaultSystem}>
      <OrdersListCards items={items} loading={false} />
    </ChakraProvider>,
  );
  expect(screen.getByText("ORDER-0")).toBeVisible();
  expect(screen.getAllByRole("link").length).toBeLessThan(200);
  offset = 44000;
  act(() => window.dispatchEvent(new Event("scroll")));
  expect(screen.queryByText("ORDER-0")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link").length).toBeLessThan(200);
  offset = 0;
  act(() => window.dispatchEvent(new Event("scroll")));
  expect(screen.getByText("ORDER-0")).toBeVisible();
});
