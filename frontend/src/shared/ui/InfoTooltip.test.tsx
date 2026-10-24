import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InfoTooltip } from "./InfoTooltip";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderTooltip(reasons = ["У части сотрудников не указан пол"]) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <InfoTooltip label="Причины статуса нормы" reasons={reasons} />
      <button type="button">Вне подсказки</button>
    </ChakraProvider>,
  );
}

it("opens on hover and closes when the pointer leaves", async () => {
  const user = userEvent.setup();
  renderTooltip();
  const trigger = screen.getByRole("button", { name: "Причины статуса нормы" });
  await user.hover(trigger);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "У части сотрудников не указан пол",
  );
  await user.unhover(trigger);
  await waitFor(() =>
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
  );
});

it("opens with keyboard focus and closes with Escape", async () => {
  const user = userEvent.setup();
  renderTooltip();
  await user.tab();
  const tooltip = await screen.findByRole("tooltip");
  const trigger = screen.getByRole("button", { name: "Причины статуса нормы" });
  expect(trigger).toHaveFocus();
  expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
  );
});

it("toggles on touch-style clicks and closes on outside press", async () => {
  const user = userEvent.setup();
  renderTooltip(["Первая причина", "Вторая причина"]);
  const trigger = screen.getByRole("button", { name: "Причины статуса нормы" });
  await user.click(trigger);
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.querySelectorAll("li")).toHaveLength(2);
  expect(tooltip.parentElement?.closest("table")).toBeNull();
  await user.click(trigger);
  await waitFor(() =>
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
  );
  await user.click(trigger);
  await screen.findByRole("tooltip");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Вне подсказки" }));
  await waitFor(() =>
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
  );
});
