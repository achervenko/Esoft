import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { GenderToggle, type Gender } from "./GenderToggle";

afterEach(cleanup);

it("starts unselected, supports arrow keys and occupies one Tab stop", async () => {
  function Form() {
    const [value, setValue] = useState<Gender | "">("");
    return <><GenderToggle value={value} onChange={setValue} /><button>Далее</button></>;
  }
  const user = userEvent.setup();
  render(<Form />);
  expect(screen.getByRole("radiogroup", { name: /Пол/ })).toBeInTheDocument();
  const male = screen.getByRole("radio", { name: "Мужской" });
  const female = screen.getByRole("radio", { name: "Женский" });
  expect(male).not.toBeChecked();
  expect(female).not.toBeChecked();
  await user.tab();
  expect(male).toHaveFocus();
  expect(male).not.toBeChecked();
  await user.keyboard("{ArrowRight}");
  expect(female).toHaveFocus();
  expect(female).toBeChecked();
  await user.keyboard("{ArrowLeft}");
  expect(male).toBeChecked();
  expect(female).not.toBeChecked();
  await user.tab();
  expect(screen.getByRole("button", { name: "Далее" })).toHaveFocus();
});
