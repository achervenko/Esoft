import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { ApiRequestError } from "../../shared/api/api-error";
import { act } from "@testing-library/react";
import { NormFormModal } from "./NormFormModal";
import { item, norm } from "./ppe-test-fixtures";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("PPE norm editor", () => {
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
    render(
      <NormFormModal
        state={{ mode: "create", norm: null }}
        position={{ id: 1, name: "Механик", isActive: true }}
        items={[item]}
        onClose={onClose}
        onChanged={onChanged}
      />,
    );
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
    render(
      <NormFormModal
        state={{ mode: "create", norm: null }}
        position={{ id: 1, name: "Механик", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
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

  it("keeps the inherited gender read-only when editing a norm", () => {
    render(
      <NormFormModal
        state={{ mode: "edit", norm: { ...norm, gender: "FEMALE" } }}
        position={{ id: 1, name: "Механик", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: "Женский" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Женский" })).toBeDisabled();
  });

  it("saves a hard transition and a daily period without a mode selector", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
    render(
      <NormFormModal
        state={{ mode: "revision", norm }}
        position={{ id: 2, name: "Инженер", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
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
    render(
      <NormFormModal
        state={{ mode: "revision", norm }}
        position={{ id: 2, name: "Инженер", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
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
  it("prevents a duplicate item in another row and handles a locked future norm", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockRejectedValue(
      new ApiRequestError("Locked", 409, "PPE_NORM_LOCKED"),
    );
    render(
      <NormFormModal
        state={{ mode: "edit", norm }}
        position={{ id: 2, name: "Инженер", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
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
