import type {
  SelectDropdownNavigationDirection,
  SelectDropdownOption,
} from "./select-dropdown.types";
import {
  getFocusableElements,
  isElementVisible,
} from "../focusable-elements";

export function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  if (index < 0) {
    return length - 1;
  }

  if (index >= length) {
    return 0;
  }

  return index;
}

export function getNextEnabledIndex(
  options: SelectDropdownOption[],
  startIndex: number,
  direction: SelectDropdownNavigationDirection = 1,
) {
  if (options.length === 0) {
    return 0;
  }

  const normalizedStartIndex = clampIndex(startIndex, options.length);

  for (let offset = 0; offset < options.length; offset += 1) {
    const candidateIndex = clampIndex(
      normalizedStartIndex + offset * direction,
      options.length,
    );

    if (!options[candidateIndex]?.disabled) {
      return candidateIndex;
    }
  }

  return normalizedStartIndex;
}

export const getModalFocusableElements = getFocusableElements;
export { isElementVisible };

export function getAdjacentFocusableElementForDropdown(
  focusableElements: HTMLElement[],
  triggerElement: HTMLElement | null,
  direction: SelectDropdownNavigationDirection,
) {
  const triggerIndex = triggerElement
    ? focusableElements.indexOf(triggerElement)
    : -1;

  if (triggerIndex < 0) {
    return undefined;
  }

  return focusableElements[triggerIndex + direction];
}
