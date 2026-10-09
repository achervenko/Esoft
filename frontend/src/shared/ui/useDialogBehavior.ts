import { useEffect, type KeyboardEvent, type RefObject } from "react";
import { getFocusableElements } from "./focusable-elements";

export function useDialogBehavior({
  dialogRef,
  initialFocusRef,
  onClose,
  closeDisabled = false,
}: {
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const target =
      initialFocusRef?.current ??
      dialog.querySelector<HTMLElement>("[autofocus]") ??
      getFocusableElements(dialog)[0] ??
      dialog;
    target.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [dialogRef, initialFocusRef]);

  const close = () => {
    if (!closeDisabled) onClose();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    event.stopPropagation();
    const elements = getFocusableElements(dialogRef.current);
    event.preventDefault();
    if (!elements.length) {
      dialogRef.current.focus();
      return;
    }
    const index = elements.indexOf(document.activeElement as HTMLElement);
    const next =
      index < 0
        ? event.shiftKey
          ? elements.length - 1
          : 0
        : (index + (event.shiftKey ? -1 : 1) + elements.length) %
          elements.length;
    elements[next].focus();
  };
  return { close, onKeyDown };
}
