import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { businessToday } from "../../modules/ppe-ui/ppe-presentation";
import { norm } from "./ppe-test-fixtures";
import {
  prepareNormsPanelTests,
  restoreNormsPanelTests,
  normsPanelView,
  renderNormsPanel,
} from "./norms-panel-test-utils";

beforeEach(prepareNormsPanelTests);
afterEach(restoreNormsPanelTests);

it("lists positions with and without norms and opens the selected position", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    { ...norm, effectiveFrom: "2000-01-01", effectiveTo: null },
  ]);
  renderNormsPanel({
    positions: [
      { id: norm.positionId, name: norm.position, isActive: true },
      { id: 99, name: "Без нормы", isActive: true },
    ],
  });
  const position = await screen.findByText(norm.position);
  expect(
    within(position.closest("tr")!).getByText("Нормы заданы"),
  ).toBeInTheDocument();
  const empty = screen.getByText("Без нормы").closest("tr")!;
  expect(
    within(position.closest("tr")!).queryByRole("button", {
      name: /Причины статуса/,
    }),
  ).toBeNull();
  expect(within(empty).getByText("Нет норм")).toBeInTheDocument();
  fireEvent.click(within(empty).getByRole("button", { name: "Открыть" }));
  fireEvent.click(screen.getByRole("button", { name: "Добавить норму" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(ppeApi.norms).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
});

it("synchronizes the position route and closes the previous position's norm form", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([]);
  const props = {
    positions: [
      { id: 10, name: "Должность А", isActive: true },
      { id: 20, name: "Должность Б", isActive: true },
    ],
    permissions: ["ppe.read", "ppe.norms.manage"],
  };
  const panel = (id?: number) =>
    normsPanelView({
      ...props,
      initialPositionId: id,
    });
  const view = render(panel(10));
  expect(
    screen.getByRole("heading", { name: "Должность А" }),
  ).toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Добавить норму" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(panel(20));
  expect(
    screen.getByRole("heading", { name: "Должность Б" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Должность А" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(panel());
  expect(screen.getByLabelText("Поиск по должностям")).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Должность Б" }),
  ).not.toBeInTheDocument();
});

it("closes lifecycle actions belonging to the previous position", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    {
      ...norm,
      positionId: 10,
      effectiveFrom: businessToday(),
      effectiveTo: null,
    },
  ]);
  const props = {
    positions: [
      { id: 10, name: "Должность А", isActive: true },
      { id: 20, name: "Должность Б", isActive: true },
    ],
    permissions: ["ppe.read", "ppe.norms.manage"],
  };
  const panel = (id: number) =>
    normsPanelView({
      ...props,
      initialPositionId: id,
    });
  const view = render(panel(10));
  fireEvent.click(
    await screen.findByRole("button", { name: "Завершить действие" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(panel(20));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Должность Б" }),
  ).toBeInTheDocument();
});
