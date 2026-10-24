import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export function useSelectDropdownPopup({
  triggerRef,
  isOpen,
  disabled,
  isDialogReady,
  optionCount,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  disabled: boolean;
  isDialogReady: boolean;
  optionCount: number;
}) {
  const [menuStyle, setMenuStyle] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [ownerModalId, setOwnerModalId] = useState<string | null>(null);
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportBottom =
      viewportTop + (window.visualViewport?.height ?? window.innerHeight);
    const below = Math.max(0, viewportBottom - rect.bottom - 18);
    const above = Math.max(0, rect.top - viewportTop - 18);
    const desiredHeight = Math.min(280, optionCount * 42 + 2);
    const opensAbove = below < desiredHeight && above > below;
    const maxHeight = Math.max(42, Math.min(280, opensAbove ? above : below));

    setMenuStyle({
      left: rect.left,
      top: opensAbove
        ? Math.max(
            viewportTop + 12,
            rect.top - 6 - Math.min(desiredHeight, maxHeight),
          )
        : rect.bottom + 6,
      width: rect.width,
      maxHeight,
    });
  }, [optionCount, triggerRef]);

  useLayoutEffect(() => {
    if (!isOpen || disabled || !isDialogReady) {
      setMenuStyle(null);
      setOwnerModalId(null);
      return;
    }

    setOwnerModalId(
      triggerRef.current?.closest<HTMLElement>("[data-admin-modal-id]")?.dataset
        .adminModalId ?? null,
    );
    updateMenuPosition();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateMenuPosition);
    const trigger = triggerRef.current;
    if (trigger) {
      resizeObserver?.observe(trigger);
      const dialog = trigger.closest("[data-admin-modal-id]");
      if (dialog) resizeObserver?.observe(dialog);
    }

    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      resizeObserver?.disconnect();
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [triggerRef, isOpen, disabled, updateMenuPosition, isDialogReady]);

  return { menuStyle, ownerModalId };
}
