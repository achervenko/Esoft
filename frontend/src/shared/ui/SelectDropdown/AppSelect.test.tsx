import { DialogPopupReadyContext } from "../DialogPopupReadyContext";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppSelect } from "./AppSelect";
import { SelectDropdown } from "./SelectDropdown";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([false, true])(
  "closes an open dropdown when disabled and allows reopening after enabling (multiple=%s)",
  (multiple) => {
    const props = {
      label: "Тип",
      value: "a",
      onChange: vi.fn(),
      options: [{ value: "a", label: "Первый" }],
      selectedValues: multiple ? ["a"] : undefined,
    };
    const view = render(<SelectDropdown {...props} />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    view.rerender(<SelectDropdown {...props} disabled />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
    view.rerender(<SelectDropdown {...props} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  },
);

it.each([false, true])(
  "moves Tab focus relative to the trigger outside a modal (shift=%s)",
  (shiftKey) => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    render(
      <div>
        <input aria-label="До" />
        <AppSelect value="a">
          <option value="a">Первый</option>
        </AppSelect>
        <input aria-label="После" disabled />
        <button>Далее</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Первый" }));
    const option = screen.getByRole("option", { name: "Первый" });
    expect(option).toHaveFocus();
    fireEvent.keyDown(option, { key: "Tab", shiftKey });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      shiftKey
        ? screen.getByLabelText("До")
        : screen.getByRole("button", { name: "Далее" }),
    ).toHaveFocus();
  },
);
it("forwards required and error semantics to the trigger and combines descriptions", () => {
  const view = render(
    <AppSelect
      aria-label="Тип"
      required
      aria-invalid="true"
      aria-describedby="field-error"
      value="a"
    >
      <option value="a">Первый</option>
    </AppSelect>,
  );
  const trigger = screen.getByRole("button", { name: "Первый" });
  expect(trigger).toHaveAttribute("aria-required", "true");
  expect(trigger).toHaveAttribute("aria-invalid", "true");
  const ids = trigger.getAttribute("aria-describedby")!.split(" ");
  expect(ids).toHaveLength(2);
  expect(document.getElementById(ids[0])).toHaveTextContent("Тип");
  expect(ids[1]).toBe("field-error");
  view.rerender(
    <AppSelect aria-label="Тип" value="a">
      <option value="a">Первый</option>
    </AppSelect>,
  );
  expect(trigger).not.toHaveAttribute("aria-required");
  expect(trigger).not.toHaveAttribute("aria-invalid");
  expect(trigger.getAttribute("aria-describedby")).not.toContain("field-error");
});
it("selects through the shared menu and preserves native form values", () => {
  function Form() {
    const [value, setValue] = useState("BODY");
    return (
      <form aria-label="Форма">
        <label>
          <span>Тип</span>
          <AppSelect
            name="type"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="BODY">Одежда</option>
            <option value="FEET">Обувь</option>
            <option value="HEAD" disabled>
              Головной убор
            </option>
          </AppSelect>
        </label>
      </form>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Одежда" }));
  expect(screen.getByRole("option", { name: "Головной убор" })).toBeDisabled();
  fireEvent.click(screen.getByRole("option", { name: "Обувь" }));
  expect(screen.getByRole("button", { name: "Обувь" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).get("type"),
  ).toBe("FEET");
});
it("supports keyboard selection and Escape", () => {
  const change = vi.fn();
  render(
    <AppSelect value="a" onChange={(event) => change(event.target.value)}>
      <option value="a">Первый</option>
      <option value="b">Второй</option>
    </AppSelect>,
  );
  const trigger = screen.getByRole("button", { name: "Первый" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("option", { name: "Первый" }), {
    key: "ArrowDown",
  });
  fireEvent.keyDown(screen.getByRole("option", { name: "Второй" }), {
    key: "Enter",
  });
  expect(change).toHaveBeenCalledOnce();
  expect(change).toHaveBeenCalledWith("b");
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole("option", { name: "Первый" }), {
    key: "Escape",
  });
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("does not expose a portalled dropdown before its dialog is ready", () => {
  const viewFor = (ready: boolean) => (
    <DialogPopupReadyContext.Provider value={ready}>
      <AppSelect value="a">
        <option value="a">Первый</option>
      </AppSelect>
    </DialogPopupReadyContext.Provider>
  );
  const view = render(viewFor(false));
  const trigger = screen.getByRole("button", { name: "Первый" });
  fireEvent.click(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  view.rerender(viewFor(true));
  fireEvent.click(trigger);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  view.rerender(viewFor(false));
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  view.rerender(viewFor(true));
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
});
