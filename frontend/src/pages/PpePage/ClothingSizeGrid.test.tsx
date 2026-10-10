import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { ClothingSizeGrid } from "../../modules/ppe-ui/ClothingSizeGrid";
import { defaultClothingSizes } from "../../modules/ppe-ui/ppe-size-options";
afterEach(cleanup);
it("replaces pasted and typed dashes immediately in both inputs", () => {
  render(
    <ClothingSizeGrid values={defaultClothingSizes()} onChange={() => {}} />,
  );
  fireEvent.click(screen.getByText("Редактировать размеры"));
  fireEvent.change(screen.getByLabelText("Размер"), {
    target: { value: "44 - 46" },
  });
  fireEvent.change(screen.getByLabelText("Ростовка"), {
    target: { value: "170—176" },
  });
  expect(screen.getByLabelText("Размер")).toHaveValue("44–46");
  expect(screen.getByLabelText("Ростовка")).toHaveValue("170–176");
});
it("adds sizes and heights separately without selecting incomplete pairs", () => {
  function Form() {
    const [values, setValues] = useState(defaultClothingSizes);
    return <ClothingSizeGrid values={values} onChange={setValues} />;
  }
  render(<Form />);
  fireEvent.click(screen.getByText("Редактировать размеры"));
  fireEvent.change(screen.getByLabelText("Размер"), {
    target: { value: "44–46" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
  expect(screen.getByRole("button", { name: "44–46;158–164" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  fireEvent.change(screen.getByLabelText("Ростовка"), {
    target: { value: "150–156" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
  const pair = screen.getByRole("button", { name: "44–46;150–156" });
  expect(pair).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(pair);
  expect(pair).toHaveAttribute("aria-pressed", "true");
});
it("clears the standard grid so a different size grid can be entered", () => {
  function Form() {
    const [values, setValues] = useState(defaultClothingSizes);
    return <ClothingSizeGrid values={values} onChange={setValues} />;
  }
  render(<Form />);
  fireEvent.click(screen.getByText("Редактировать размеры"));
  fireEvent.click(screen.getByRole("button", { name: "Сбросить размеры" }));
  expect(screen.queryByRole("button", { name: "88–92;158–164" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Размер"), {
    target: { value: "44–46" },
  });
  fireEvent.change(screen.getByLabelText("Ростовка"), {
    target: { value: "160–166" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
  expect(screen.getByRole("button", { name: "44–46;160–166" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.queryByRole("button", { name: "88–92;158–164" })).toBeNull();
});
it("preselects photo pairs and independently toggles nonstandard combinations", () => {
  function Form() {
    const [values, setValues] = useState(defaultClothingSizes);
    return <ClothingSizeGrid values={values} onChange={setValues} />;
  }
  render(<Form />);
  expect(defaultClothingSizes()).toHaveLength(20);
  const uncommon = screen.getByRole("button", { name: "88–92;194–200" });
  expect(uncommon).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(uncommon);
  expect(uncommon).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "88–92;170–176" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "88–92;170–176" }));
  expect(screen.getByRole("button", { name: "88–92;170–176" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
it("orders custom heights numerically among the standard heights", () => {
  render(
    <ClothingSizeGrid
      values={[
        ...defaultClothingSizes(),
        { value: "120–124", heightValue: "206–212" },
        { value: "120–124", heightValue: "150–158" },
        { value: "120–124", heightValue: "176–182" },
      ]}
      onChange={() => {}}
    />,
  );
  expect(
    screen
      .getAllByRole("button")
      .filter((button) =>
        button.getAttribute("aria-label")?.startsWith("120–124;"),
      )
      .map((button) => button.textContent),
  ).toEqual([
    "150–158",
    "158–164",
    "170–176",
    "176–182",
    "182–188",
    "194–200",
    "206–212",
  ]);
});
