import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import {
  getAdjacentFocusableElementForDropdown,
  getModalFocusableElements,
  getNextEnabledIndex,
} from "./select-dropdown-focus";
import type {
  SelectDropdownOption,
  SelectDropdownProps,
} from "./select-dropdown.types";

export function useSelectDropdown({
  disabled = false,
  onChange,
  options,
  value,
}: Pick<SelectDropdownProps, "disabled" | "onChange" | "options" | "value">) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [ownerModalId, setOwnerModalId] = useState<string | null>(null);
  const listboxId = useId();
  const triggerId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    setMenuStyle({
      left: rect.left,
      top: rect.bottom + 6,
      width: rect.width,
    });
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const selectOption = (option: SelectDropdownOption) => {
    if (option.disabled) {
      return;
    }

    onChange(option.value);
    closeMenu();
    triggerRef.current?.focus();
  };

  const openMenu = (nextActiveIndex = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled || options.length === 0) {
      return;
    }

    const resolvedActiveIndex = getNextEnabledIndex(options, nextActiveIndex);
    const nextOwnerModalId =
      triggerRef.current
        ?.closest<HTMLElement>("[data-admin-modal-id]")
        ?.dataset.adminModalId ?? null;

    setOwnerModalId(nextOwnerModalId);
    updateMenuPosition();
    setActiveIndex(resolvedActiveIndex);
    setIsOpen(true);
  };

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
      return;
    }

    openMenu();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const activeOption = optionRefs.current[activeIndex];

    activeOption?.focus();
    activeOption?.scrollIntoView({ block: "nearest" });

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        (triggerRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, [activeIndex, isOpen]);

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

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: SelectDropdownOption,
  ) => {
    if (event.key === "Tab") {
      const modal = ownerModalId
        ? document.querySelector<HTMLElement>(
            `[data-admin-modal-id="${ownerModalId}"]`,
          )
        : null;

      if (modal) {
        const focusableElements = getModalFocusableElements(modal);
        const nextFocusableElement = getAdjacentFocusableElementForDropdown(
          focusableElements,
          triggerRef.current,
          event.shiftKey ? -1 : 1,
        );
        const fallbackFocusableElement = event.shiftKey
          ? focusableElements[focusableElements.length - 1]
          : focusableElements[0];

        if (nextFocusableElement || fallbackFocusableElement) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
          requestAnimationFrame(() => {
            (nextFocusableElement ?? fallbackFocusableElement)?.focus();
          });
          return;
        }
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
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
  };

  const closeOnFocusLeave = (event: FocusEvent<HTMLElement>) => {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      (triggerRef.current?.contains(nextFocusedElement) ||
        menuRef.current?.contains(nextFocusedElement))
    ) {
      return;
    }

    closeMenu();
  };

  return {
    activeIndex,
    closeOnFocusLeave,
    handleOptionFocus: (optionIndex: number) => {
      if (!options[optionIndex]?.disabled) {
        setActiveIndex(optionIndex);
      }
    },
    handleOptionKeyDown,
    handleTriggerKeyDown,
    isOpen,
    listboxId,
    menuRef,
    menuStyle,
    onOptionClick: selectOption,
    openMenu,
    optionRefs,
    ownerModalId,
    selectedOption,
    toggleMenu,
    triggerId,
    triggerRef,
  };
}
