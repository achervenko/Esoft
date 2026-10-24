import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { norm } from "./ppe-test-fixtures";
import {
  prepareNormsPanelTests,
  restoreNormsPanelTests,
  renderNormsPanel,
} from "./norms-panel-test-utils";

beforeEach(prepareNormsPanelTests);
afterEach(restoreNormsPanelTests);

it("offers creation from the list after choosing an active position", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([]);
  renderNormsPanel({
    positions: [
      { id: norm.positionId, name: norm.position, isActive: true },
      { id: 99, name: "Удалённая должность", isActive: false },
    ],
  });
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Добавить норму" }));
  fireEvent.focus(screen.getByRole("combobox", { name: /Должность/ }));
  fireEvent.change(screen.getByRole("combobox", { name: /Должность/ }), {
    target: { value: norm.position },
  });
  expect(screen.getByRole("listbox")).toHaveAttribute(
    "data-placement",
    "bottom",
  );
  fireEvent.click(await screen.findByRole("option", { name: norm.position }));
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(
    screen.getByRole("dialog", { name: `Должность: ${norm.position}` }),
  ).toBeInTheDocument();
});
