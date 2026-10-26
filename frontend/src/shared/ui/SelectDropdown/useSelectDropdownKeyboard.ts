import {
  useCallback,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { getNextEnabledIndex } from "./select-dropdown-focus";
import type { SelectDropdownOption } from "./select-dropdown.types";

type Props = {
  disabled: boolean;
  multiple: boolean;
  isOpen: boolean;
  options: SelectDropdownOption[];
  selectedIndex: number;
  activeIndex: number;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  keyboardChoice: RefObject<boolean>;
  triggerRef: RefObject<HTMLElement | null>;
  openMenu: (index?: number) => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  selectOption: (option: SelectDropdownOption) => void;
  handleOptionTab: (event: KeyboardEvent<HTMLElement>) => void;
};

export function useSelectDropdownKeyboard({
  disabled,
  multiple,
  isOpen,
  options,
  selectedIndex,
  activeIndex,
  setActiveIndex,
  keyboardChoice,
  triggerRef,
  openMenu,
  closeMenu,
  toggleMenu,
  selectOption,
  handleOptionTab,
}: Props) {
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMenu();
      return;
    }

    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        event.stopPropagation();
      }

      closeMenu();
    }
  };

  const handleOptionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, option: SelectDropdownOption) => {
      if (event.key === "Tab") {
        handleOptionTab(event);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((currentIndex) =>
          getNextEnabledIndex(options, currentIndex + 1, 1),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((currentIndex) =>
          getNextEnabledIndex(options, currentIndex - 1, -1),
        );
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(getNextEnabledIndex(options, 0, 1));
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(getNextEnabledIndex(options, options.length - 1, -1));
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectOption(option);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    },
    [
      handleOptionTab,
      closeMenu,
      options,
      selectOption,
      setActiveIndex,
      triggerRef,
    ],
  );

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      const index = getNextEnabledIndex(
        options,
        activeIndex < 0
          ? event.key === "ArrowDown"
            ? 0
            : options.length - 1
          : activeIndex + (event.key === "ArrowDown" ? 1 : -1),
        event.key === "ArrowDown" ? 1 : -1,
      );
      setActiveIndex(index);
      keyboardChoice.current = true;
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (multiple && !keyboardChoice.current) {
        closeMenu();
        return;
      }
      if (!isOpen) {
        openMenu();
        return;
      }
      const option =
        options[getNextEnabledIndex(options, Math.max(0, activeIndex))];
      if (option) selectOption(option);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    } else if (event.key === "Tab") {
      closeMenu();
    }
  };

  const handleOptionFocus = useCallback(
    (optionIndex: number) => {
      if (!options[optionIndex]?.disabled) setActiveIndex(optionIndex);
    },
    [options, setActiveIndex],
  );

  return {
    handleTriggerKeyDown,
    handleOptionKeyDown,
    handleSearchKeyDown,
    handleOptionFocus,
  };
}
