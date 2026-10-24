import { useLayoutEffect, useState, type RefObject } from "react";
import { useMediaQuery } from "../lib/useMediaQuery";

export function useMobileDialogViewport(
  dialogRef: RefObject<HTMLElement | null>,
  backdropRef: RefObject<HTMLElement | null>,
) {
  const [isReady, setIsReady] = useState(true);
  const isMobile = useMediaQuery("(max-width: 760px)");

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const backdrop = backdropRef.current;
    const dialog = dialogRef.current;
    if (!isMobile || !viewport || !backdrop || !dialog) return;

    let settleTimer: number | undefined;
    let fallbackTimer: number | undefined;
    let pendingFocusScroll = false;
    let focusFrame: number | undefined;
    const reveal = () => {
      dialog.removeAttribute("data-viewport-pending");
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
      const focused = document.activeElement;
      if (isTextInput(focused)) {
        const rect = focused.getBoundingClientRect();
        if (pendingFocusScroll) {
          pendingFocusScroll = false;
          const form = focused.closest("form");
          if (form && dialog.contains(form)) {
            const top = Math.max(
              0,
              Math.min(
                form.scrollHeight - form.clientHeight,
                form.scrollTop +
                  rect.top -
                  form.getBoundingClientRect().top -
                  Math.max(0, (form.clientHeight - rect.height) / 3),
              ),
            );
            if (Math.abs(top - form.scrollTop) > 1) {
              form.scrollTo({
                top,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
              waitForSettle();
              return;
            }
          }
        }
        if (
          rect.top < viewport.offsetTop ||
          rect.bottom > viewport.offsetTop + viewport.height
        ) {
          // Allow one more settling interval without waiting forever for visibility.
          fallbackTimer = window.setTimeout(() => setIsReady(true), 120);
          return;
        }
      }
      setIsReady(true);
    };
    const isTextInput = (element: EventTarget | null): element is HTMLElement =>
      element instanceof HTMLElement &&
      dialog.contains(element) &&
      element.matches(
        'input:not([type="checkbox"]):not([type="radio"]), textarea',
      );
    const waitForViewport = () => {
      setIsReady(false);
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
      // Hardware keyboards do not resize the viewport.
      fallbackTimer = window.setTimeout(reveal, 500);
    };
    const focused = document.activeElement;
    if (isTextInput(focused)) {
      pendingFocusScroll = true;
      dialog.setAttribute("data-viewport-pending", "");
      waitForViewport();
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!isTextInput(event.target)) return;
      pendingFocusScroll = true;
      if (viewport.height < window.innerHeight - 100) {
        setIsReady(false);
        if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
        focusFrame = requestAnimationFrame(() => {
          focusFrame = undefined;
          reveal();
        });
      } else if (!isTextInput(event.relatedTarget)) waitForViewport();
      else waitForSettle();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        event.pointerType !== "touch" ||
        !isTextInput(target) ||
        !target.matches('input[role="combobox"]:not(:disabled)')
      )
        return;
      if (target === document.activeElement) {
        pendingFocusScroll = true;
        waitForSettle();
        return;
      }
      event.preventDefault();
      target.focus({ preventScroll: true });
    };

    const update = () => {
      backdrop.style.setProperty(
        "--dialog-viewport-height",
        `${viewport.height}px`,
      );
      backdrop.style.setProperty(
        "--dialog-viewport-top",
        `${viewport.offsetTop}px`,
      );
    };
    const waitForSettle = () => {
      setIsReady(false);
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(reveal, 120);
    };
    const onViewportChange = () => {
      update();
      waitForSettle();
    };
    const onDialogScroll = () => {
      if (isTextInput(document.activeElement)) waitForSettle();
    };
    update();
    dialog.addEventListener("focusin", onFocusIn);
    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("scroll", onDialogScroll, true);
    viewport.addEventListener("resize", onViewportChange);
    viewport.addEventListener("scroll", onViewportChange);
    return () => {
      dialog.removeEventListener("focusin", onFocusIn);
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("scroll", onDialogScroll, true);
      viewport.removeEventListener("resize", onViewportChange);
      viewport.removeEventListener("scroll", onViewportChange);
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      dialog.removeAttribute("data-viewport-pending");
      setIsReady(true);
      backdrop.style.removeProperty("--dialog-viewport-height");
      backdrop.style.removeProperty("--dialog-viewport-top");
    };
  }, [isMobile, dialogRef, backdropRef]);

  return { isMobile, isReady };
}
