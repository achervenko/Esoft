import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export type SearchSelectPopupPosition = {
  style: CSSProperties;
  owner?: string;
};

export function useSearchSelectPopup({
  inputRef,
  isOpen,
  disabled,
  isDialogReady,
  placement,
  optionCount,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  disabled: boolean;
  isDialogReady: boolean;
  placement: "auto" | "bottom";
  optionCount: number;
}) {
  const [popup, setPopup] = useState<SearchSelectPopupPosition | null>(null);
  useLayoutEffect(() => {
    if (!isOpen || disabled || !isDialogReady) {
      setPopup(null);
      return;
    }
    const position = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportBottom =
        viewportTop + (window.visualViewport?.height ?? window.innerHeight);
      const below = Math.max(0, viewportBottom - rect.bottom - 14);
      const above = Math.max(0, rect.top - viewportTop - 14);
      const opensAbove = placement === "auto" && below < 240 && above > below;
      const width = Math.min(rect.width, Math.max(0, window.innerWidth - 16));
      setPopup({
        owner: input.closest<HTMLElement>("[data-admin-modal-id]")?.dataset
          .adminModalId,
        style: {
          position: "fixed",
          left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
          right: "auto",
          width,
          top: opensAbove ? "auto" : rect.bottom + 6,
          bottom: opensAbove ? window.innerHeight - rect.top + 6 : "auto",
          maxHeight: Math.min(240, opensAbove ? above : below),
          transformOrigin: opensAbove ? "bottom" : "top",
          zIndex: 1000,
        },
      });
    };
    position();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(position);
    const input = inputRef.current;
    if (input) {
      resizeObserver?.observe(input);
      const dialog = input.closest("[data-admin-modal-id]");
      if (dialog) resizeObserver?.observe(dialog);
    }
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      resizeObserver?.disconnect();
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [inputRef, isOpen, disabled, optionCount, isDialogReady, placement]);

  return popup;
}
