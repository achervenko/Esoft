import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { ApiRequestError } from "../../shared/api/api-error";
import { norm } from "./ppe-test-fixtures";
import { renderNormForm } from "./norm-form-test-utils";

describe("PPE norm editor: errors", () => {
  it("prevents a duplicate item in another row and handles a locked future norm", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockRejectedValue(
      new ApiRequestError("Locked", 409, "PPE_NORM_LOCKED"),
    );
    renderNormForm({
      state: { mode: "edit", norm },
      position: { id: 2, name: "Инженер", isActive: true },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    const newItemSearch = screen.getAllByRole("combobox", { name: "СИЗ" })[1];
    fireEvent.focus(newItemSearch);
    fireEvent.change(newItemSearch, { target: { value: "A-01" } });
    expect(
      screen.queryByRole("option", { name: /A-01/ }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(newItemSearch, {
      key: "Escape",
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Норму уже нельзя изменить.",
    );
  });
});
