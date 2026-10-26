import { useSelectPopupRoom } from "./useSelectPopupRoom";
import {
  useCallback,
  useLayoutEffect,
  useState,
  useRef,
  type RefObject,
  type CSSProperties,
} from "react";

export function useSelectDropdownPopup({
  triggerRef,
  isOpen,
  disabled,
  isDialogReady,
  optionCount,
  alwaysDown = false,
  menuRef,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  disabled: boolean;
  isDialogReady: boolean;
  optionCount: number;
  alwaysDown?: boolean;
  menuRef?: RefObject<HTMLElement | null>;
}) {
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [ownerModalId, setOwnerModalId] = useState<string | null>(null);
  const optionCountRef = useRef(optionCount);
  optionCountRef.current = optionCount;
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportBottom =
      viewportTop + (window.visualViewport?.height ?? window.innerHeight);
    const below = Math.max(0, viewportBottom - rect.bottom - 18);
    const above = Math.max(0, rect.top - viewportTop - 18);
    const desiredHeight = Math.min(
      280,
      Math.max(42, optionCountRef.current * 42) + 2,
    );
    const opensAbove = !alwaysDown && below < desiredHeight && above > below;
    const maxHeight = Math.max(0, Math.min(280, opensAbove ? above : below));
    const width = Math.min(rect.width, Math.max(0, viewportWidth - 24));

    const nextStyle: CSSProperties = {
      left: Math.max(
        viewportLeft + 12,
        Math.min(rect.left, viewportLeft + viewportWidth - width - 12),
      ),
      top: opensAbove ? "auto" : rect.bottom + 6,
      bottom: opensAbove ? window.innerHeight - rect.top + 6 : "auto",
      transformOrigin: opensAbove ? "bottom" : "top",
      width,
      maxHeight: alwaysDown ? 280 : maxHeight,
    };
    setMenuStyle((previous) =>
      previous &&
      Object.keys(nextStyle).every(
        (key) =>
          previous[key as keyof CSSProperties] ===
          nextStyle[key as keyof CSSProperties],
      )
        ? previous
        : nextStyle,
    );
  }, [triggerRef, alwaysDown]);

  useLayoutEffect(() => {
    if (isOpen && !disabled && isDialogReady) updateMenuPosition();
  }, [optionCount, isOpen, disabled, isDialogReady, updateMenuPosition]);

  const makingRoom = useSelectPopupRoom({
    triggerRef,
    isOpen,
    disabled: disabled || !isDialogReady,
    alwaysDown,
    optionCountRef,
    updateMenuPosition,
  });

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
    let positionFrame: number | undefined;
    const schedulePosition = (event?: Event) => {
      if (
        event?.target instanceof Node &&
        menuRef?.current?.contains(event.target)
      )
        return;
      if (positionFrame !== undefined) return;
      positionFrame = requestAnimationFrame(() => {
        positionFrame = undefined;
        updateMenuPosition();
      });
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => schedulePosition());
    const trigger = triggerRef.current;
    if (trigger) {
      resizeObserver?.observe(trigger);
      const dialog = trigger.closest("[data-admin-modal-id]");
      if (dialog) resizeObserver?.observe(dialog);
    }

    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", schedulePosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", schedulePosition, true);

    return () => {
      resizeObserver?.disconnect();
      if (positionFrame !== undefined) cancelAnimationFrame(positionFrame);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", schedulePosition, true);
    };
  }, [
    triggerRef,
    menuRef,
    isOpen,
    disabled,
    updateMenuPosition,
    isDialogReady,
  ]);

  return {
    menuStyle: makingRoom ? null : menuStyle,
    ownerModalId,
  };
}
