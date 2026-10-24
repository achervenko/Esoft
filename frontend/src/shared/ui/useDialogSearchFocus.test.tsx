import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { SearchSelect } from "./SearchSelect";
import { useDialogSearchFocus } from "./useDialogSearchFocus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("waits again when focus is re-enabled or the input is replaced", () => {
  vi.useFakeTimers();
  function Field({
    enabled,
    inputKey,
  }: {
    enabled: boolean;
    inputKey: string;
  }) {
    const { ref, ready } = useDialogSearchFocus(enabled);
    return (
      <>
        <input key={inputKey} ref={ref} />
        <output>{String(ready)}</output>
      </>
    );
  }
  const view = render(<Field enabled inputKey="first" />);
  const expectReady = (ready: boolean) =>
    expect(screen.getByRole("status")).toHaveTextContent(String(ready));
  expectReady(false);
  act(() => vi.advanceTimersByTime(160));
  expectReady(true);
  view.rerender(<Field enabled={false} inputKey="first" />);
  expectReady(true);
  view.rerender(<Field enabled inputKey="first" />);
  expectReady(false);
  act(() => vi.advanceTimersByTime(160));
  expectReady(true);
  view.rerender(<Field enabled inputKey="replacement" />);
  expectReady(false);
  act(() => vi.advanceTimersByTime(160));
  expectReady(true);
});

it("reopens an earlier search when another row cancels its pending focus animation", async () => {
  vi.useFakeTimers();
  function Form() {
    const [count, setCount] = useState(1);
    return (
      <form>
        {Array.from({ length: count }, (_, index) => (
          <SearchSelect
            key={index}
            label={`СИЗ ${index}`}
            value={null}
            onChange={() => {}}
            focusOnMount={index === count - 1}
            options={[{ id: 1, name: "Ботинки" }]}
          />
        ))}
        <button type="button" onClick={() => setCount(count + 1)}>
          Добавить
        </button>
      </form>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button"));
  const earlier = screen.getByRole("combobox", { name: "СИЗ 1" });
  act(() => earlier.focus());
  expect(earlier).toHaveAttribute("aria-expanded", "true");
  expect(
    document.getElementById(earlier.getAttribute("aria-controls")!),
  ).toHaveRole("listbox");
  await act(async () => vi.advanceTimersByTime(160));
  expect(earlier).toHaveFocus();
});
