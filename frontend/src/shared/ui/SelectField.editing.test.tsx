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
it("keeps multiple selection open and preserves selected values hidden by a search", () => {
  function Multiple() {
    const [value, setValue] = useState<string[]>(["b"]);
    return (
      <SelectField
        label="Должности"
        options={options}
        searchable
        multiple
        value={value}
        onChange={setValue}
      />
    );
  }
  render(<Multiple />);
  fireEvent.click(screen.getByRole("combobox", { name: "Должности" }));
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Кладовщик, инженер" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Главный инженер" }));
  expect(screen.getByRole("listbox")).toHaveAttribute(
    "aria-multiselectable",
    "true",
  );
  expect(
    (screen.getByRole("combobox", { name: "Должности" }) as HTMLInputElement)
      .value,
  ).toContain("Кладовщик");
  expect(
    screen.getByRole("option", { name: "Главный инженер" }),
  ).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("option", { name: "Главный инженер" }));
  expect(
    screen.getByRole("option", { name: "Главный инженер" }),
  ).toHaveAttribute("aria-selected", "false");
});

it("opens and closes with the arrow while keeping a single labeled input", () => {
  render(
    <SelectField
      label="Должность"
      searchable
      options={options}
      value=""
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Должность" });
  expect(screen.getByLabelText("Должность")).toBe(input);
  fireEvent.click(
    screen.getByRole("button", { name: "Показать варианты: Должность" }),
  );
  expect(input).toHaveFocus();
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  const toggle = screen.getByRole("button", {
    name: "Скрыть варианты: Должность",
  });
  fireEvent.pointerDown(toggle);
  fireEvent.mouseDown(toggle);
  fireEvent.click(toggle);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(input.closest("label")).toBeNull();
});

it("replaces the old single label on the first typed character, then continues the new search", () => {
  render(
    <SelectField
      label="Должность"
      searchable
      options={options}
      value="b"
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox");
  act(() => input.focus());
  expect(input).toHaveValue("Кладовщик");
  fireEvent.change(input, { target: { value: "КладовщикИ" } });
  expect(input).toHaveValue("И");
  fireEvent.change(input, { target: { value: "Инженер" } });
  expect(input).toHaveValue("Инженер");
  expect(screen.getAllByRole("option")).toHaveLength(1);
  expect(
    screen.getByRole("option", { name: "Главный инженер" }),
  ).toBeInTheDocument();
});

it("keeps deletion normal and replaces a single label with pasted text", () => {
  render(
    <SelectField
      label="Должность"
      searchable
      options={options}
      value="b"
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox");
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "Кладовщи" } });
  expect(input).toHaveValue("Кладовщи");
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.click(input);
  fireEvent.paste(input, { clipboardData: { getData: () => "инженер" } });
  expect(input).toHaveValue("инженер");
});

it("synchronizes deleting selected labels with the multiple selection", () => {
  const change = vi.fn();
  function Editable() {
    const [value, setValue] = useState(["b", "9007199254740993"]);
    return (
      <SelectField
        label="Должности"
        options={options}
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
  render(<Editable />);
  const input = screen.getByRole("combobox");
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "Главный инженер" } });
  expect(change).toHaveBeenLastCalledWith(["9007199254740993"]);
  expect(screen.getByRole("option", { name: "Кладовщик" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  expect(
    screen.getByRole("option", { name: "Главный инженер" }),
  ).toHaveAttribute("aria-selected", "true");
  fireEvent.change(input, { target: { value: "Главный инжене" } });
  expect(change).toHaveBeenLastCalledWith([]);
  expect(
    screen.getByRole("option", { name: "Главный инженер" }),
  ).toHaveAttribute("aria-selected", "false");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
});

it("commits multiple edits on Enter without selecting the first or hovered result; Tab never selects", () => {
  const change = vi.fn();
  function Multiple() {
    const [value, setValue] = useState(["b", "9007199254740993"]);
    return (
      <SelectField
        label="Должности"
        options={options}
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
  expect(change).toHaveBeenLastCalledWith(["b"]);
  change.mockClear();
  fireEvent.mouseMove(screen.getByRole("option", { name: "Главный инженер" }));
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveValue("Кладовщик");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Tab" });
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveValue("Кладовщик");
});

it("starts a new search after multiple selections without requiring a manually typed comma", () => {
  const choices = [
    { value: "storekeeper", label: "Кладовщик" },
    { value: "ppe", label: "Специалист по охране труда" },
    { value: "operator", label: "Оператор" },
  ];
  const change = vi.fn();
  function Multiple() {
    const [value, setValue] = useState<string[]>([]);
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
  fireEvent.click(screen.getByRole("option", { name: "Кладовщик" }));
  fireEvent.click(
    screen.getByRole("option", { name: "Специалист по охране труда" }),
  );
  expect(input).toHaveValue("Кладовщик, Специалист по охране труда");
  change.mockClear();
  fireEvent.change(input, {
    target: { value: "Кладовщик, Специалист по охране трудаО" },
  });
  expect(input).toHaveValue("Кладовщик, Специалист по охране труда, О");
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, {
    target: { value: "Кладовщик, Специалист по охране труда, Опер" },
  });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fireEvent.click(screen.getByRole("option", { name: "Оператор" }));
  expect(change).toHaveBeenLastCalledWith(["storekeeper", "ppe", "operator"]);
  expect(input).toHaveValue("Кладовщик, Специалист по охране труда, Оператор");
});

it.each([0, 8, 9, 10])(
  "separates a new search at a selected label boundary (%s)",
  (at) => {
    const choices = [
      { value: "op", label: "Оператор" },
      { value: "account", label: "Специалист по учету" },
      { value: "eng", label: "Инженер" },
    ];
    const change = vi.fn();
    function Multiple() {
      const [value, setValue] = useState(["op", "account"]);
      return (
        <SelectField
          label="Должности"
          options={choices}
          searchable
          multiple
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
    const previous = input.value;
    const next = previous.slice(0, at) + "Ин" + previous.slice(at);
    fireEvent.change(input, {
      target: { value: next, selectionStart: at + 2, selectionEnd: at + 2 },
    });
    expect(change).not.toHaveBeenCalled();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Инженер" })).toBeInTheDocument();
    const caret = input.selectionStart!;
    fireEvent.change(input, {
      target: {
        value: input.value.slice(0, caret) + "ж" + input.value.slice(caret),
        selectionStart: caret + 1,
        selectionEnd: caret + 1,
      },
    });
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "Инженер" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Инженер" }));
    expect(change).toHaveBeenLastCalledWith(["op", "account", "eng"]);
  },
);

it.each([0, 1])(
  "searches the edited token at position %s and keeps the other selections",
  (position) => {
    const choices = [
      { value: "storekeeper", label: "Кладовщик" },
      { value: "operator", label: "Оператор" },
      { value: "ppe", label: "Специалист по учету" },
      { value: "engineer", label: "Инженер" },
    ];
    const change = vi.fn();
    function Multiple() {
      const [value, setValue] = useState(["storekeeper", "operator", "ppe"]);
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
    const text =
      position === 0
        ? "Ин, Оператор, Специалист по учету"
        : "Кладовщик, Ин, Специалист по учету";
    const caret = text.indexOf("Ин") + 2;
    fireEvent.change(input, {
      target: { value: text, selectionStart: caret, selectionEnd: caret },
    });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Инженер" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Инженер" }));
    expect(change).toHaveBeenLastCalledWith(
      position === 0
        ? ["operator", "ppe", "engineer"]
        : ["storekeeper", "ppe", "engineer"],
    );
  },
);
