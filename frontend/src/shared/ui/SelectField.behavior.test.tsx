import { useState } from "react";
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

it.each([
  { searchable: false, multiple: false },
  { searchable: true, multiple: false },
  { searchable: false, multiple: true },
  { searchable: true, multiple: true },
])(
  "validates required without name ($searchable, $multiple)",
  ({ searchable, multiple }) => {
    const submit = vi.fn();
    function Form() {
      const [value, setValue] = useState("");
      const [values, setValues] = useState<string[]>([]);
      const common = {
        label: "Должность",
        options,
        required: true,
        searchable,
      };
      return (
        <form
          aria-label="Форма"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {multiple ? (
            <SelectField
              {...common}
              multiple
              value={values}
              onChange={setValues}
            />
          ) : (
            <SelectField {...common} value={value} onChange={setValue} />
          )}
          <button type="submit">Сохранить</button>
        </form>
      );
    }
    render(<Form />);
    const form = screen.getByRole("form") as HTMLFormElement;
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(submit).not.toHaveBeenCalled();
    expect(form.checkValidity()).toBe(false);
    const trigger = screen.getByRole(searchable ? "combobox" : "button", {
      name: "Должность",
    });
    expect(trigger).toHaveFocus();
    if (!screen.queryByRole("listbox")) fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Главный инженер" }));
    expect(form.checkValidity()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(submit).toHaveBeenCalledOnce();
    expect([...new FormData(form)]).toEqual([]);
  },
);

it.each([{ required: false }, { required: true, disabled: true }])(
  "does not block submission for optional or disabled unnamed fields (%j)",
  (flags) => {
    render(
      <form aria-label="Форма">
        <SelectField
          label="Должность"
          options={options}
          value=""
          onChange={vi.fn()}
          {...flags}
        />
      </form>,
    );
    expect((screen.getByRole("form") as HTMLFormElement).checkValidity()).toBe(
      true,
    );
  },
);

it("supports native FormData and required validation when a name is supplied", () => {
  function Form() {
    const [value, setValue] = useState("");
    return (
      <form aria-label="Форма">
        <SelectField
          name="position"
          label="Должность"
          options={options}
          value={value}
          onChange={setValue}
          required
        />
      </form>
    );
  }
  render(<Form />);
  const form = screen.getByRole("form") as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  expect(screen.getByRole("button", { name: "Должность" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Должность" }));
  fireEvent.click(screen.getByRole("option", { name: "Главный инженер" }));
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get("position")).toBe("9007199254740993");
});

it("serializes multiple IDs without coercion and excludes disabled fields from FormData", () => {
  const view = render(
    <form aria-label="Форма">
      <SelectField
        name="positions"
        label="Должности"
        options={options}
        multiple
        value={["9007199254740993", "b"]}
        onChange={vi.fn()}
      />
    </form>,
  );
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).getAll(
      "positions",
    ),
  ).toEqual(["9007199254740993", "b"]);
  view.rerender(
    <form aria-label="Форма">
      <SelectField
        name="positions"
        label="Должности"
        options={options}
        multiple
        disabled
        value={["b"]}
        onChange={vi.fn()}
      />
    </form>,
  );
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).has("positions"),
  ).toBe(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("filters labels without changing string IDs and restores all options on reopen", () => {
  const change = vi.fn();
  render(
    <SelectField
      label="Должность"
      searchable
      options={options}
      value=""
      onChange={change}
    />,
  );
  const trigger = screen.getByRole("combobox", { name: "Должность" });
  fireEvent.click(trigger);
  const search = screen.getByRole("combobox", { name: "Должность" });
  act(() => search.focus());
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.getByRole("listbox").querySelector("input")).toBeNull();
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: "  ИНЖЕНЕР  " } });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fireEvent.click(screen.getByRole("option", { name: "Главный инженер" }));
  expect(change).toHaveBeenCalledWith("9007199254740993");
  expect(trigger).not.toHaveFocus();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(screen.getAllByRole("option")).toHaveLength(3);
});

it("does not offer search for a short list and keeps required/error semantics", () => {
  render(
    <SelectField
      label="Статус"
      required
      error="Выберите статус"
      options={options}
      value="b"
      onChange={vi.fn()}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Статус" });
  expect(trigger).toHaveAttribute("aria-required", "true");
  expect(trigger).toHaveAttribute("aria-invalid", "true");
  expect(trigger).toHaveAccessibleDescription("Выберите статус");
  fireEvent.click(trigger);
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Кладовщик" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("option", { name: "Оператор" })).toBeDisabled();
});

it("supports search keyboard navigation and Escape without bubbling to a dialog", () => {
  const escape = vi.fn();
  const change = vi.fn();
  render(
    <div onKeyDown={escape}>
      <SelectField
        label="Выбор"
        searchable
        options={options}
        value=""
        onChange={change}
      />
    </div>,
  );
  const trigger = screen.getByRole("combobox", { name: "Выбор" });
  act(() => trigger.focus());
  const search = screen.getByRole("combobox");
  fireEvent.keyDown(search, { key: "ArrowDown" });
  const first = screen.getByRole("option", { name: "Главный инженер" });
  expect(search).toHaveFocus();
  expect(search).toHaveAttribute("aria-activedescendant", first.id);
  fireEvent.keyDown(search, { key: "ArrowUp" });
  expect(search).toHaveAttribute(
    "aria-activedescendant",
    screen.getByRole("option", { name: "Кладовщик" }).id,
  );
  fireEvent.keyDown(search, { key: "ArrowDown" });
  fireEvent.keyDown(search, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("9007199254740993");
  expect(search).not.toHaveFocus();
  act(() => trigger.focus());
  fireEvent.click(trigger);
  escape.mockClear();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  expect(escape).not.toHaveBeenCalled();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("shows an empty result, does not submit on Enter and allows editing the query again", () => {
  const submit = vi.fn();
  const change = vi.fn();
  render(
    <form onSubmit={submit}>
      <SelectField
        label="Выбор"
        searchable
        options={options}
        value=""
        onChange={change}
      />
    </form>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Выбор" }));
  const search = screen.getByRole("combobox");
  fireEvent.change(search, { target: { value: "нет такого" } });
  expect(screen.getByRole("status")).toHaveTextContent("Ничего не найдено");
  fireEvent.keyDown(search, { key: "Enter" });
  expect(change).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getAllByRole("option")).toHaveLength(3);
});

it("closes when disabled or a dialog is not ready", () => {
  const props = {
    label: "Выбор",
    searchable: true,
    options,
    value: "",
    onChange: vi.fn(),
  };
  const view = render(<SelectField {...props} />);
  fireEvent.click(screen.getByRole("combobox", { name: "Выбор" }));
  view.rerender(<SelectField {...props} disabled />);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Выбор" })).toBeDisabled();
  view.rerender(
    <DialogPopupReadyContext.Provider value={false}>
      <SelectField {...props} />
    </DialogPopupReadyContext.Provider>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Выбор" }));
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it("discards an unselected draft on blur and Escape without changing the selected value", () => {
  const change = vi.fn();
  render(
    <>
      <SelectField
        label="Должность"
        searchable
        options={options}
        value="b"
        onChange={change}
      />
      <button>Далее</button>
    </>,
  );
  const input = screen.getByRole("combobox");
  expect(input).toHaveValue("Кладовщик");
  act(() => input.focus());
  expect(screen.getAllByRole("option")).toHaveLength(3);
  fireEvent.change(input, { target: { value: "не выбрано" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("Кладовщик");
  fireEvent.click(input);
  fireEvent.change(input, { target: { value: "не выбрано" } });
  act(() => screen.getByRole("button", { name: "Далее" }).focus());
  expect(input).toHaveValue("Кладовщик");
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it.each(["Кладовщик,Оператор", "Кладовщик, Оператор", "Кладовщик ,  Оператор"])(
  "edits only the last selection independently of comma spacing: %s",
  (text) => {
    const choices = [
      { value: "storekeeper", label: "Кладовщик" },
      { value: "ppe", label: "Специалист по охране труда" },
      { value: "operator", label: "Оператор" },
    ];
    const change = vi.fn();
    function Multiple() {
      const [value, setValue] = useState(["storekeeper", "ppe"]);
      return (
        <SelectField
          label="Должности"
          options={choices}
          multiple
          searchable
          value={value}
          onChange={(next) => {
            change(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Multiple />);
    const input = screen.getByRole("combobox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Кладовщик," } });
    expect(change).toHaveBeenLastCalledWith(["storekeeper"]);
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenLastCalledWith(["storekeeper", "operator"]);
    expect(input).toHaveValue("Кладовщик, Оператор");
    expect(screen.getByRole("option", { name: "Кладовщик" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("option", { name: "Специалист по охране труда" }),
    ).toHaveAttribute("aria-selected", "false");
  },
);

it("preserves both neighbours when a middle label is deleted leaving repeated commas", () => {
  const choices = [
    { value: "storekeeper", label: "Кладовщик" },
    { value: "operator", label: "Оператор" },
    { value: "accountant", label: "Специалист по учету" },
  ];
  const change = vi.fn();
  function Multiple() {
    const [value, setValue] = useState([
      "storekeeper",
      "operator",
      "accountant",
    ]);
    return (
      <SelectField
        label="Должности"
        options={choices}
        multiple
        searchable
        value={value}
        onChange={(next) => {
          change(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Multiple />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  act(() => input.focus());
  input.setSelectionRange(11, 19);
  fireEvent.click(input);
  expect(input.selectionStart).toBe(11);
  fireEvent.change(input, {
    target: { value: "Кладовщик, , Специалист по учету" },
  });
  expect(change).toHaveBeenLastCalledWith(["storekeeper", "accountant"]);
  expect(screen.getByRole("option", { name: "Кладовщик" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.getByRole("option", { name: "Специалист по учету" }),
  ).toHaveAttribute("aria-selected", "true");
  change.mockClear();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(input).toHaveValue("Кладовщик, Специалист по учету");
});
