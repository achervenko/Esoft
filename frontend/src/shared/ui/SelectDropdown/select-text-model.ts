import type { SelectDropdownOption } from "./select-dropdown.types";

export type SelectedSpan = { value: string; start: number; end: number };
export type SelectTextDocument = { text: string; spans: SelectedSpan[] };

export function createSelectDocument(
  options: SelectDropdownOption[],
  values: ReadonlySet<string>,
): SelectTextDocument {
  let text = "";
  const spans: SelectedSpan[] = [];
  for (const option of options) {
    if (!values.has(option.value)) continue;
    if (spans.length) text += ", ";
    const start = text.length;
    text += option.label;
    spans.push({ value: option.value, start, end: text.length });
  }
  return { text, spans };
}

// IDs belong to ranges, not labels: equal names and commas in a name are safe.
export function editSelectDocument(
  previous: SelectTextDocument,
  text: string,
  caret: number,
) {
  caret = Math.max(0, Math.min(caret, text.length));
  let start = 0;
  while (
    start < caret &&
    start < previous.text.length &&
    previous.text[start] === text[start]
  )
    start++;
  let end = previous.text.length;
  let newEnd = text.length;
  while (
    newEnd > caret &&
    end > start &&
    previous.text[end - 1] === text[newEnd - 1]
  ) {
    end--;
    newEnd--;
  }
  // A paste/test may report the caret at the end; still retain an unchanged suffix.
  if (
    newEnd === text.length &&
    end === previous.text.length &&
    caret === text.length
  ) {
    while (
      end > start &&
      newEnd > start &&
      previous.text[end - 1] === text[newEnd - 1]
    ) {
      end--;
      newEnd--;
    }
  }
  let inserted = text.slice(start, newEnd);
  let caretAdjustment = 0;
  if (start === end && inserted.trim() && !inserted.includes(",")) {
    const before = previous.spans.some((span) => span.end === start);
    const after = previous.spans.some(
      (span) =>
        span.start >= start && !previous.text.slice(start, span.start).trim(),
    );
    if (before) {
      inserted = ", " + inserted;
      caretAdjustment += 2;
    }
    if (after) inserted += ", ";
  }
  const delta = inserted.length - (end - start);
  const spans = previous.spans.flatMap((span) => {
    if (span.end <= start) return [span];
    if (span.start >= end)
      return [{ ...span, start: span.start + delta, end: span.end + delta }];
    return [];
  });
  const next = {
    text: previous.text.slice(0, start) + inserted + previous.text.slice(end),
    spans,
  };
  const retainedIds = new Set(spans.map((span) => span.value));
  const labelCounts = new Map<string, number>();
  for (const span of previous.spans) {
    const label = previous.text.slice(span.start, span.end);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  // A single replacement can also move an unchanged token (cut/paste).
  for (const old of previous.spans) {
    if (retainedIds.has(old.value)) continue;
    const label = previous.text.slice(old.start, old.end);
    if (labelCounts.get(label) !== 1) continue;
    let at = next.text.indexOf(label);
    while (at >= 0) {
      const end = at + label.length;
      if (
        (!next.text.slice(0, at).trim() ||
          next.text.slice(0, at).trimEnd().endsWith(",")) &&
        (!next.text.slice(end).trim() ||
          next.text.slice(end).trimStart().startsWith(",")) &&
        !spans.some((span) => span.start < end && span.end > at)
      ) {
        spans.push({ value: old.value, start: at, end });
        break;
      }
      at = next.text.indexOf(label, at + 1);
    }
  }
  spans.sort((a, b) => a.start - b.start);
  return { ...next, caret: caret + caretAdjustment };
}

export function getSelectSearchTerm(
  document: SelectTextDocument,
  caret: number,
) {
  caret = Math.max(0, Math.min(caret, document.text.length));
  if (document.spans.some((span) => caret >= span.start && caret <= span.end))
    return "";
  const before =
    document.spans.filter((span) => span.end <= caret).at(-1)?.end ?? 0;
  const after =
    document.spans.find((span) => span.start >= caret)?.start ??
    document.text.length;
  const fragment = document.text.slice(before, after);
  const relative = caret - before;
  const start = relative > 0 ? fragment.lastIndexOf(",", relative - 1) + 1 : 0;
  const comma = fragment.indexOf(",", relative);
  return fragment.slice(start, comma < 0 ? fragment.length : comma).trim();
}
