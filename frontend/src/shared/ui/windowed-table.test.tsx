import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("bounds the mounted rows of a 5000-entry journal and restores rows and actions when scrolling back", () => {
  let top = 0;
  let scheduled: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    scheduled = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        top: this.tagName === "TBODY" ? -top : 0,
        width: 1000,
        height: this.dataset.gridIndex ? 40 : 800,
      } as DOMRect;
    },
  );
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    () =>
      ({
        overflowY: "visible",
        gridTemplateColumns: "none",
        rowGap: "normal",
      }) as CSSStyleDeclaration,
  );
  const open = vi.fn();
  const rows = Array.from({ length: 5000 }, (_, id) => ({
    id,
    name: `Выдача ${id}`,
  }));
  render(
    <DataTable
      windowed
      serverSorted
      rows={rows}
      getRowKey={(row) => row.id}
      defaultSort={{ key: "name", direction: "asc" }}
      onRowClick={(row) => open(row.id)}
      columns={[{ key: "name", label: "Выдача", render: (row) => row.name }]}
    />,
    {
      wrapper: ({ children }) => (
        <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
      ),
    },
  );
  expect(screen.getByText("Выдача 0")).toBeInTheDocument();
  expect(document.querySelectorAll("[data-grid-index]").length).toBeLessThan(
    180,
  );
  top = 40 * 600;
  act(() => window.dispatchEvent(new Event("scroll")));
  act(() => scheduled?.(0));
  expect(screen.queryByText("Выдача 0")).toBeNull();
  fireEvent.click(screen.getByText("Выдача 600"));
  expect(open).toHaveBeenLastCalledWith(600);
  expect(document.querySelectorAll("[data-grid-index]").length).toBeLessThan(
    180,
  );
  expect(
    document.querySelector<HTMLElement>(".data-table-spacer td")?.style.height,
  ).toBe("20000px");
  top = 0;
  act(() => window.dispatchEvent(new Event("scroll")));
  act(() => scheduled?.(0));
  fireEvent.click(screen.getByText("Выдача 0"));
  expect(open).toHaveBeenLastCalledWith(0);
  expect(screen.queryByText("Выдача 600")).toBeNull();
  expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
});
