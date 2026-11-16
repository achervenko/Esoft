import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReservationItemRow } from "./ReservationItemRow";
import { row } from "./reservation-modal-test-utils";
afterEach(cleanup);
it("hides commands from read-only users", () => {
  render(
    <ReservationItemRow
      reservation={row}
      expanded
      onToggle={vi.fn()}
      permissions={["warehouse.reservations.read"]}
      onOperation={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Уменьшить резерв" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Операции с резервом/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Обеспечить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Переместить" }),
  ).not.toBeInTheDocument();
});
it("checks each permission independently and keeps operation buttons outside the disclosure", () => {
  const onOperation = vi.fn(),
    onToggle = vi.fn();
  const { rerender } = render(
    <ReservationItemRow
      reservation={row}
      expanded
      onToggle={onToggle}
      permissions={["warehouse.reservations.coverage.manage"]}
      onOperation={onOperation}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /^Операции с резервом: А-02$/ }),
  );
  expect(onOperation).toHaveBeenCalledWith({
    kind: "reduce",
    reservation: row,
    locationId: "1",
  });
  expect(onToggle).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Операции с резервом: не обеспечено" }),
  );
  expect(onOperation).toHaveBeenLastCalledWith({
    kind: "restore",
    reservation: row,
  });
  expect(
    screen.queryByRole("button", { name: "Переместить" }),
  ).not.toBeInTheDocument();
  rerender(
    <ReservationItemRow
      reservation={row}
      expanded
      onToggle={onToggle}
      permissions={[
        "warehouse.reservations.manage",
        "warehouse.transfers.manage",
      ]}
      onOperation={onOperation}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Уменьшить резерв" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Переместить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Обеспечить" }),
  ).not.toBeInTheDocument();
});
