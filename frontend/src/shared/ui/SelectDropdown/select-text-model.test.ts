import { expect, it } from "vitest";
import {
  createSelectDocument,
  editSelectDocument,
  getSelectSearchTerm,
} from "./select-text-model";

it("distinguishes equal labels by their original ranges and IDs", () => {
  const document = createSelectDocument(
    [
      { value: "a", label: "Инженер" },
      { value: "b", label: "Инженер" },
    ],
    new Set(["a", "b"]),
  );
  const removeFirst = editSelectDocument(document, "Инженер", 0);
  expect(removeFirst.spans.map((span) => span.value)).toEqual(["b"]);
  const removeLast = editSelectDocument(document, "Инженер", 7);
  expect(removeLast.spans.map((span) => span.value)).toEqual(["a"]);
});

it("treats commas inside a selected label as part of its ID range", () => {
  const document = createSelectDocument(
    [
      { value: "9007199254740993", label: "Инженер, старший" },
      { value: "b", label: "Кладовщик" },
    ],
    new Set(["9007199254740993", "b"]),
  );
  expect(getSelectSearchTerm(document, 9)).toBe("");
  const edit = editSelectDocument(
    document,
    document.text + "Оп",
    document.text.length + 2,
  );
  expect(edit.text).toBe("Инженер, старший, Кладовщик, Оп");
  expect(edit.spans.map((span) => span.value)).toEqual([
    "9007199254740993",
    "b",
  ]);
  expect(getSelectSearchTerm(edit, edit.caret)).toBe("Оп");
});

it("preserves IDs when options are renamed or reordered before a new editing session", () => {
  const ids = new Set(["a", "b"]);
  const document = createSelectDocument(
    [
      { value: "b", label: "Новое имя" },
      { value: "a", label: "Другое имя" },
    ],
    ids,
  );
  expect(document.spans.map((span) => span.value)).toEqual(["b", "a"]);
  expect(document.text).toBe("Новое имя, Другое имя");
});
