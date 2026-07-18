export function getFocusableElements(container: HTMLElement) {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      isElementVisible(element, container),
  );
}

export function isElementVisible(element: HTMLElement, container: HTMLElement) {
  if (element.getClientRects().length === 0) {
    return false;
  }

  let currentElement: HTMLElement | null = element;

  while (currentElement && currentElement !== container.parentElement) {
    const style = window.getComputedStyle(currentElement);

    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    if (currentElement === container) {
      break;
    }

    currentElement = currentElement.parentElement;
  }

  return true;
}
