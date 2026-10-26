import { useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import {
  createSelectDocument,
  editSelectDocument,
  getSelectSearchTerm,
  type SelectTextDocument,
} from "./select-text-model";
import type { SelectDropdownOption } from "./select-dropdown.types";

export function useSelectTextEditor(
  options: SelectDropdownOption[],
  selectedValues: string[] | undefined,
  value: string,
) {
  const selected = useMemo(
    () => new Set(selectedValues ?? [value]),
    [selectedValues, value],
  );
  const document = useMemo(
    () => createSelectDocument(options, selected),
    [options, selected],
  );
  const draft = useRef<SelectTextDocument | null>(null);
  const pendingValues = useRef<string[] | null>(null);
  const source = useRef({ options, selectedValues, value });
  const [query, setQuery] = useState("");
  const [caret, setCaret] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const reset = useCallback(() => {
    draft.current = null;
    pendingValues.current = null;
    setQuery("");
    setCaret(0);
    setIsTyping(false);
  }, []);
  useLayoutEffect(() => {
    const previous = source.current;
    const sameValues = (a: string[] | undefined, b: string[] | undefined) =>
      a === b ||
      (a !== undefined &&
        b !== undefined &&
        a.length === b.length &&
        a.every((id, index) => id === b[index]));
    const optionsChanged =
      previous.options !== options &&
      (previous.options.length !== options.length ||
        previous.options.some(
          (option, index) =>
            option.value !== options[index].value ||
            option.label !== options[index].label ||
            option.disabled !== options[index].disabled,
        ));
    const selectionChanged =
      !sameValues(previous.selectedValues, selectedValues) ||
      (selectedValues === undefined && previous.value !== value);
    // A controlled parent acknowledging our deletion must keep the active draft.
    const acknowledged =
      selectionChanged &&
      pendingValues.current !== null &&
      sameValues(pendingValues.current, selectedValues);
    if (optionsChanged || (selectionChanged && !acknowledged)) reset();
    if (selectionChanged) pendingValues.current = null;
    source.current = { options, selectedValues, value };
  }, [options, selectedValues, value, reset]);
  const change = (text: string, position: number, inserted?: string | null) => {
    let next: SelectTextDocument;
    if (selectedValues) {
      const edited = editSelectDocument(
        draft.current ?? document,
        text,
        position,
      );
      next = edited;
      position = edited.caret;
    } else {
      if (!draft.current && document.text) {
        if (inserted) text = inserted;
        else if (text.length > document.text.length) {
          let start = 0;
          while (
            start < document.text.length &&
            text[start] === document.text[start]
          )
            start++;
          let suffix = 0;
          while (
            suffix < document.text.length - start &&
            text.at(-1 - suffix) === document.text.at(-1 - suffix)
          )
            suffix++;
          text = text.slice(start, text.length - suffix);
        }
      }
      next = { text, spans: [] };
      position = Math.min(position, text.length);
    }
    draft.current = next;
    setQuery(next.text);
    setCaret(position);
    setIsTyping(true);
    const retained = new Set(next.spans.map((span) => span.value));
    // Missing options keep their IDs until the caller explicitly removes them.
    const known = new Set(document.spans.map((span) => span.value));
    const values = selectedValues?.filter(
      (id) => retained.has(id) || !known.has(id),
    );
    if (values && values.length !== selectedValues?.length)
      pendingValues.current = values;
    return {
      text: next.text,
      caret: position,
      values,
    };
  };
  const searchTerm = selectedValues
    ? getSelectSearchTerm(draft.current ?? { text: "", spans: [] }, caret)
    : query.trim();
  return {
    query,
    isTyping,
    selectedText: document.text,
    searchTerm,
    change,
    reset,
    setCaret,
  };
}
