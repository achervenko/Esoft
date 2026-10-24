import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { norm } from "./ppe-test-fixtures";
import { renderNormForm } from "./norm-form-test-utils";

describe("PPE norm editor: validation", () => {
  it("marks gender invalid when native required validation blocks submit", () => {
    renderNormForm();
    fireEvent.invalid(screen.getByRole("radio", { name: "Мужской" }));
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Выберите пол для нормы.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Женский" }));
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Выберите пол для нормы.")).toBeNull();
  });

  it("does not mark newly added rows invalid until another save attempt", () => {
    const save = vi.spyOn(ppeApi, "saveNorm");
    renderNormForm();
    fireEvent.click(screen.getByRole("radio", { name: "Женский" }));
    const first = screen.getByRole("combobox", { name: /СИЗ/ });
    const form = first.closest("form")!;
    fireEvent.submit(form);
    expect(first).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    const added = screen.getAllByRole("combobox", { name: /СИЗ/ }).at(-1)!;
    expect(added).not.toHaveAttribute("aria-invalid");
    expect(first).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("Выберите СИЗ из списка.")).toHaveLength(1);
    fireEvent.submit(form);
    expect(added).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("Выберите СИЗ из списка.")).toHaveLength(2);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(["", "Произвольный текст"])(
    "requires selecting PPE before saving (search=%s)",
    async (query) => {
      const save = vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
      renderNormForm();
      fireEvent.click(screen.getByRole("radio", { name: "Женский" }));
      const input = screen.getByRole("combobox", { name: /СИЗ/ });
      fireEvent.change(input, { target: { value: query } });
      fireEvent.submit(input.closest("form")!);
      expect(save).not.toHaveBeenCalled();
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getByText(
          query
            ? "СИЗ с таким названием или артикулом не найден. Выберите позицию из списка."
            : "Выберите СИЗ из списка.",
        ),
      ).toBeInTheDocument();
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.focus(input);
      fireEvent.click(screen.getByRole("option"));
      expect(input).not.toHaveAttribute("aria-invalid");
      expect(
        screen.queryByText("Выберите СИЗ из списка."),
      ).not.toBeInTheDocument();
      fireEvent.submit(input.closest("form")!);
      await waitFor(() => expect(save).toHaveBeenCalledOnce());
    },
  );
});
