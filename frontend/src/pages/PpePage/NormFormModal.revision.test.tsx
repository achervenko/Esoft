import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { norm } from "./ppe-test-fixtures";
import { renderNormForm } from "./norm-form-test-utils";

describe("PPE norm editor: revision", () => {
  it("keeps the inherited gender read-only when editing a norm", () => {
    renderNormForm({
      state: { mode: "edit", norm: { ...norm, gender: "FEMALE" } },
    });
    expect(screen.getByRole("radio", { name: "Женский" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Женский" })).toBeDisabled();
  });

  it("saves a hard transition and a daily period without a mode selector", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
    renderNormForm({
      state: { mode: "revision", norm },
      position: { id: 2, name: "Инженер", isActive: true },
    });
    const toggle = screen.getByRole("switch", { name: "Жёсткий переход" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    fireEvent.click(screen.getByLabelText("Как работают переходы"));
    expect(screen.getByText(/Выключено — мягкий переход/)).toBeVisible();
    expect(screen.queryByLabelText("Расчёт выдачи")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Единица периода"), {
      target: { value: "DAY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
    await waitFor(() =>
      expect(ppeApi.saveNorm).toHaveBeenCalledWith(
        "revision",
        9,
        2,
        expect.objectContaining({
          transitionMode: "HARD",
          items: [expect.objectContaining({ periodUnit: "DAY" })],
        }),
      ),
    );
  });

  it("copies the full revision composition, omitting previous row IDs", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
    renderNormForm({
      state: { mode: "revision", norm },
      position: { id: 2, name: "Инженер", isActive: true },
    });
    fireEvent.change(screen.getByLabelText("Дата начала"), {
      target: { value: "2099-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
    await waitFor(() =>
      expect(ppeApi.saveNorm).toHaveBeenCalledWith("revision", 9, 2, {
        effectiveFrom: "2099-02-01",
        effectiveTo: null,
        transitionMode: "SOFT",
        items: [
          {
            ppeItemId: 3,
            quantity: 2,
            periodCount: 1,
            periodUnit: "YEAR",
          },
        ],
      }),
    );
  });
});
