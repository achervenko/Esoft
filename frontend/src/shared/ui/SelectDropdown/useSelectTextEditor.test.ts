import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useSelectTextEditor } from "./useSelectTextEditor";

const options = [
  { value: "a", label: "Инженер" },
  { value: "b", label: "Кладовщик" },
];
afterEach(cleanup);

it("resets a multiple draft on external selection changes before the next edit", () => {
  const { result, rerender } = renderHook(
    ({ ids }) => useSelectTextEditor(options, ids, ids[0] ?? ""),
    { initialProps: { ids: ["a"] } },
  );
  act(() => {
    result.current.change("Инженер, Кл", 11);
  });
  rerender({ ids: ["b"] });
  expect(result.current.isTyping).toBe(false);
  expect(result.current.selectedText).toBe("Кладовщик");
  let edit;
  act(() => {
    edit = result.current.change("КладовщикОп", 11);
  });
  expect(edit).toMatchObject({ text: "Кладовщик, Оп", values: ["b"] });
});

it("resets a single draft when the controlled value changes", () => {
  const { result, rerender } = renderHook(
    ({ value }) => useSelectTextEditor(options, undefined, value),
    { initialProps: { value: "a" } },
  );
  act(() => {
    result.current.change("Кл", 2, "Кл");
  });
  rerender({ value: "b" });
  expect(result.current.isTyping).toBe(false);
  expect(result.current.query).toBe("");
  expect(result.current.selectedText).toBe("Кладовщик");
});

it.each([
  { nextOptions: options.slice(1) },
  { nextOptions: [...options].reverse() },
  { nextOptions: [{ ...options[0], label: "Новое имя" }, options[1]] },
])("resets stale ranges when options change (%j)", ({ nextOptions }) => {
  const { result, rerender } = renderHook(
    ({ choices }) => useSelectTextEditor(choices, ["a", "b"], "a"),
    { initialProps: { choices: options } },
  );
  act(() => {
    result.current.change("Инженер, Кладовщик, Оп", 21);
  });
  rerender({ choices: nextOptions });
  expect(result.current.isTyping).toBe(false);
  expect(result.current.query).toBe("");
});

it("keeps draft and search when the parent acknowledges a deletion or recreates equivalent props", () => {
  const { result, rerender } = renderHook(
    ({ ids, choices }) => useSelectTextEditor(choices, ids, ids[0] ?? ""),
    { initialProps: { ids: ["a", "b"], choices: options } },
  );
  act(() => {
    result.current.change("Инженер, Кл", 11);
  });
  rerender({ ids: ["a"], choices: options.map((option) => ({ ...option })) });
  expect(result.current.isTyping).toBe(true);
  expect(result.current.query).toBe("Инженер, Кл");
  expect(result.current.searchTerm).toBe("Кл");
  rerender({ ids: ["a"], choices: [...options] });
  expect(result.current.query).toBe("Инженер, Кл");
});
