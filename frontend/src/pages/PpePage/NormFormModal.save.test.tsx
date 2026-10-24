import { fireEvent, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { norm } from "./ppe-test-fixtures";
import { renderNormForm } from "./norm-form-test-utils";

describe("PPE norm editor: save", () => {
  it("blocks a second norm submit and permits retry after failure", async () => {
    let rejectSave!: (reason: Error) => void;
    const save = vi
      .spyOn(ppeApi, "saveNorm")
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSave = reject;
          }),
      )
      .mockResolvedValue(norm);
    const onClose = vi.fn();
    const onChanged = vi.fn();
    renderNormForm({ onClose: onClose, onChanged: onChanged });
    fireEvent.click(screen.getByRole("radio", { name: "Женский" }));
    fireEvent.focus(screen.getByRole("combobox", { name: /СИЗ/ }));
    fireEvent.click(screen.getByRole("option"));
    const form = document.querySelector("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      rejectSave(new Error("Save failed"));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledTimes(2);
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("creates a gender-specific norm without assigning gender by default", async () => {
    const save = vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
    renderNormForm();
    expect(screen.getByRole("radio", { name: "Мужской" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Женский" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Женский" }));
    fireEvent.focus(screen.getByRole("combobox", { name: /СИЗ/ }));
    fireEvent.click(screen.getByRole("option"));
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "create",
        null,
        1,
        expect.objectContaining({ gender: "FEMALE" }),
      ),
    );
  });
});
