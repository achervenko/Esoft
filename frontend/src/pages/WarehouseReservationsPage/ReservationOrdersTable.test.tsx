import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReservationOrdersTable } from "./ReservationOrdersTable";
const viewport = vi.hoisted(() => ({ mobile: true }));
vi.mock("../../shared/lib/useMediaQuery", () => ({
  useMediaQuery: () => viewport.mobile,
}));
afterEach(cleanup);
it("keeps cards across sidebar changes and opens the selected order", () => {
  const row = {
    order: {
      id: "1",
      number: "202",
      name: "Монтаж",
      status: "КОбеспечению",
      closed: false,
      warnings: [],
    },
    positionsCount: 3,
    deficitPositionsCount: 1,
  };
  const onOpen = vi.fn();
  const view = () => (
    <ChakraProvider value={defaultSystem}>
      <ReservationOrdersTable items={[row]} onOpen={onOpen} />
    </ChakraProvider>
  );
  const { rerender } = render(view());
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Монтаж"));
  expect(onOpen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Позиций: 3" }));
  expect(onOpen).toHaveBeenCalledWith(row);
  rerender(view());
  expect(
    screen.getByRole("list", { name: "Заказы с резервами" }),
  ).toBeVisible();
  viewport.mobile = false;
  rerender(view());
  expect(screen.getByRole("table")).toBeVisible();
});
