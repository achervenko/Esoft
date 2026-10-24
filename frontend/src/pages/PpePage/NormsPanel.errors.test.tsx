import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { norm } from "./ppe-test-fixtures";
import {
  prepareNormsPanelTests,
  restoreNormsPanelTests,
  normsPanelView,
} from "./norms-panel-test-utils";

beforeEach(prepareNormsPanelTests);
afterEach(restoreNormsPanelTests);

it.each([false, true])(
  "hides detail content after a reference error (hasNorm=%s)",
  async (hasNorm) => {
    vi.spyOn(ppeApi, "norms").mockResolvedValue(hasNorm ? [norm] : []);
    const panel = (error: string | null) =>
      normsPanelView({
        initialPositionId: norm.positionId,
        referenceState: { loading: false, error, reload: vi.fn() },
      });
    const view = render(panel(null));
    const content = hasNorm
      ? await screen.findByText(norm.gender === "MALE" ? "Мужской" : "Женский")
      : await screen.findByText("Для этой должности нормы пока не созданы.");
    view.rerender(panel("Ошибка загрузки справочников"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ошибка загрузки справочников",
    );
    expect(content).not.toBeInTheDocument();
  },
);
