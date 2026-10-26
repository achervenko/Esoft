import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SelectField } from "./SelectField";
import { DialogPopupReadyContext } from "./DialogPopupReadyContext";
const options = [
  { value: "9007199254740993", label: "Главный инженер" },
  { value: "b", label: "Кладовщик" },
  { value: "c", label: "Оператор", disabled: true },
];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("keeps the input mounted, focused and editable while the mobile dialog waits for its viewport", () => {
  const viewFor = (ready: boolean) => (
    <DialogPopupReadyContext.Provider value={ready}>
      <SelectField
        label="Должность"
        searchable
        options={options}
        value="b"
        onChange={vi.fn()}
      />
    </DialogPopupReadyContext.Provider>
  );
  const view = render(viewFor(true));
  const input = screen.getByRole("combobox");
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "инженер" } });
  view.rerender(viewFor(false));
  expect(screen.getByRole("combobox")).toBe(input);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("инженер");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  view.rerender(viewFor(true));
  expect(input).toHaveFocus();
  expect(input).toHaveValue("инженер");
  expect(screen.getAllByRole("option")).toHaveLength(1);
});

it("places the caret at the end of multiple selections instead of selecting their text", () => {
  render(
    <SelectField
      label="Должности"
      searchable
      multiple
      options={options}
      value={["b"]}
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox") as HTMLInputElement;
  act(() => input.focus());
  expect(input.selectionStart).toBe(input.value.length);
  expect(input.selectionEnd).toBe(input.value.length);
  input.setSelectionRange(2, 2);
  fireEvent.click(input);
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(2);
});

it.each(["touch", "pen"])(
  "preserves native %s focus and corrects the first click only",
  (pointerType) => {
    render(
      <>
        <SelectField
          label="Должности"
          searchable
          multiple
          options={options}
          value={["b"]}
          onChange={vi.fn()}
        />
        <button>Далее</button>
      </>,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    const focus = vi.spyOn(input, "focus");
    expect(fireEvent.pointerDown(input, { pointerType, button: 0 })).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    expect(input).not.toHaveFocus();
    act(() => input.focus());
    input.setSelectionRange(2, 2);
    fireEvent.click(input);
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(fireEvent.pointerDown(input, { pointerType, button: 0 })).toBe(true);
    input.setSelectionRange(2, 2);
    fireEvent.click(input);
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
    act(() => screen.getByRole("button", { name: "Далее" }).focus());
    focus.mockClear();
    expect(fireEvent.pointerDown(input, { pointerType, button: 0 })).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    act(() => input.focus());
    input.setSelectionRange(1, 1);
    fireEvent.click(input);
    expect(input.selectionStart).toBe(input.value.length);
  },
);

it("focuses immediately at the end on the first mouse press without the native intermediate caret", () => {
  render(
    <SelectField
      label="Должность"
      searchable
      options={options}
      value="b"
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox") as HTMLInputElement;
  const first = fireEvent.pointerDown(input, {
    pointerType: "mouse",
    button: 0,
  });
  expect(first).toBe(false);
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(input.value.length);
  expect(input.selectionEnd).toBe(input.value.length);
  fireEvent.click(input);
  const second = fireEvent.pointerDown(input, {
    pointerType: "mouse",
    button: 0,
  });
  expect(second).toBe(true);
  input.setSelectionRange(2, 2);
  fireEvent.click(input);
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(2);
});

it("places the caret after a single selected value on refocus without selecting or overriding a later click", () => {
  render(
    <>
      <SelectField
        label="Должность"
        options={options}
        searchable
        value="b"
        onChange={vi.fn()}
      />
      <button>Далее</button>
    </>,
  );
  const input = screen.getByRole("combobox") as HTMLInputElement;
  act(() => input.focus());
  expect(input.selectionStart).toBe(input.value.length);
  expect(input.selectionEnd).toBe(input.value.length);
  act(() => screen.getByRole("button", { name: "Далее" }).focus());
  act(() => input.focus());
  expect(input.selectionStart).toBe(input.value.length);
  expect(input.selectionEnd).toBe(input.value.length);
  input.setSelectionRange(2, 2);
  fireEvent.click(input);
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(2);
});
