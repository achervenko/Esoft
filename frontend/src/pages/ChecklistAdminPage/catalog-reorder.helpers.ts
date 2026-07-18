import type { CatalogDragKind } from "./catalog-reorder.types";

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [data-no-drag="true"]';

export function getCatalogTargetIndex(
  kind: CatalogDragKind,
  y: number,
  moduleListElement: HTMLDivElement | null,
  questionListElement: HTMLDivElement | null,
) {
  const container = kind === "module" ? moduleListElement : questionListElement;
  const selector =
    kind === "module"
      ? "[data-catalog-module-item='true']"
      : "[data-catalog-question-item='true']";
  const items = container
    ? Array.from(container.querySelectorAll<HTMLElement>(selector))
    : [];

  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();

    if (y < rect.top + rect.height / 2) {
      return index;
    }
  }

  return items.length;
}

export function isInteractiveTarget(
  target: EventTarget,
  rootElement: HTMLElement,
) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const interactiveElement = target.closest(INTERACTIVE_SELECTOR);

  return Boolean(interactiveElement && interactiveElement !== rootElement);
}
