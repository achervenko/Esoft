import {
  useCallback,
  useEffect,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  getAdjacentFocusableElementForDropdown,
  getModalFocusableElements,
} from "./select-dropdown-focus";
import { getFocusableElements } from "../focusable-elements";

type Props = {
  triggerRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  optionRefs: RefObject<Array<HTMLButtonElement | null>>;
  activeIndex: number;
  isOpen: boolean;
  isDialogReady: boolean;
  isPopupPositioned: boolean;
  searchable: boolean;
  ownerModalId: string | null;
  closeMenu: () => void;
};

export function useSelectDropdownFocus({
  triggerRef,
  menuRef,
  optionRefs,
  activeIndex,
  isOpen,
  isDialogReady,
  isPopupPositioned,
  searchable,
  ownerModalId,
  closeMenu,
}: Props) {
  useEffect(() => {
    if (!isOpen || !isDialogReady || !isPopupPositioned) {
      return undefined;
    }

    const activeOption = optionRefs.current[activeIndex];

    if (!searchable) {
      activeOption?.focus();
      activeOption?.scrollIntoView({ block: "nearest" });
    } else if (activeOption && menuRef.current) {
      const menu = menuRef.current;
      const optionTop = activeOption.offsetTop;
      const optionBottom = optionTop + activeOption.offsetHeight;
      if (optionTop < menu.scrollTop) menu.scrollTop = optionTop;
      else if (optionBottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = optionBottom - menu.clientHeight;
      }
    }
  }, [
    activeIndex,
    isOpen,
    isDialogReady,
    isPopupPositioned,
    searchable,
    optionRefs,
    menuRef,
  ]);

  useEffect(() => {
    if (!isOpen || !isDialogReady || !isPopupPositioned) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        (triggerRef.current?.contains(target) ||
          triggerRef.current
            ?.closest(".select-dropdown-field")
            ?.contains(target) ||
          menuRef.current?.contains(target))
      ) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, [
    isOpen,
    isDialogReady,
    isPopupPositioned,
    closeMenu,
    triggerRef,
    menuRef,
  ]);

  const closeOnFocusLeave = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const nextFocusedElement = event.relatedTarget;

      if (
        nextFocusedElement instanceof Node &&
        (triggerRef.current?.contains(nextFocusedElement) ||
          triggerRef.current
            ?.closest(".select-dropdown-field")
            ?.contains(nextFocusedElement) ||
          menuRef.current?.contains(nextFocusedElement))
      ) {
        return;
      }

      closeMenu();
    },
    [closeMenu, triggerRef, menuRef],
  );

  const handleOptionTab = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
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

      if (!modal) {
        const focusableElements = getFocusableElements(document.body).filter(
          (element) =>
            element.tabIndex >= 0 && !menuRef.current?.contains(element),
        );
        const nextElement = getAdjacentFocusableElementForDropdown(
          focusableElements,
          triggerRef.current,
          event.shiftKey ? -1 : 1,
        );
        closeMenu();
        event.stopPropagation();
        if (nextElement) {
          event.preventDefault();
          nextElement.focus();
        } else {
          triggerRef.current?.focus();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    },
    [ownerModalId, closeMenu, triggerRef, menuRef],
  );

  return { closeOnFocusLeave, handleOptionTab };
}
