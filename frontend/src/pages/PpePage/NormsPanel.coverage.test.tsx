import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { norm, employee } from "./ppe-test-fixtures";
import {
  prepareNormsPanelTests,
  restoreNormsPanelTests,
  renderNormsPanel,
} from "./norms-panel-test-utils";

beforeEach(prepareNormsPanelTests);
afterEach(restoreNormsPanelTests);

it.each(["missing", "historical", "future"] as const)(
  "reports coverage for male and female employees (%s)",
  async (state) => {
    vi.spyOn(ppeApi, "norms").mockResolvedValue([
      {
        ...norm,
        gender: "MALE",
        effectiveFrom: "2000-01-01",
        effectiveTo: null,
      },
      ...(state === "missing"
        ? []
        : [
            {
              ...norm,
              id: 77,
              gender: "FEMALE" as const,
              effectiveFrom: state === "future" ? "2999-01-01" : "2000-01-01",
              effectiveTo: state === "future" ? null : "2001-01-01",
            },
          ]),
    ]);
    vi.mocked(ppeApi.employees).mockResolvedValue([
      { ...employee, positionId: norm.positionId, gender: "MALE" },
      { ...employee, id: 2, positionId: norm.positionId, gender: "FEMALE" },
    ]);
    renderNormsPanel({
    });
    expect(await screen.findByText("Неполные нормы")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Пол" }),
    ).not.toBeInTheDocument();
  },
);

it("does not show coverage until employee data loads and allows retry after failure", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    {
      ...norm,
      effectiveFrom: "2000-01-01",
      effectiveTo: null,
    },
  ]);
  let reject!: (error: Error) => void;
  vi.mocked(ppeApi.employees).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  renderNormsPanel({
  });
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  reject(new Error("offline"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Нормы заданы")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("Нормы заданы");
});

it("shows problem reasons only in the tooltip and keeps its click separate from opening a position", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([]);
  const openPosition = vi.fn();
  renderNormsPanel({
    onOpenPosition: openPosition,
  });
  await screen.findByText("Нет норм");
  const tooltipTrigger = screen.getByRole("button", {
    name: `Причины статуса «Нет норм»: ${norm.position}`,
  });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.click(tooltipTrigger);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "Для должности не задана действующая или будущая норма",
  );
  expect(openPosition).not.toHaveBeenCalled();
});
