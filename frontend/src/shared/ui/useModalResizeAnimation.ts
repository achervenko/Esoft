import { useLayoutEffect, useRef, type RefObject } from "react";

export function useModalResizeAnimation(
  dialogRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const previousHeight = useRef<number | null>(null);
  const running = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !enabled || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // Field messages can change height through CSS without a React render.
      if (!running.current)
        previousHeight.current = dialog.getBoundingClientRect().height;
    });
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [dialogRef, enabled]);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.animate) return;
    if (!enabled) {
      running.current?.cancel();
      running.current = null;
      dialog.classList.remove("admin-modal-resizing");
      previousHeight.current = null;
      return;
    }
    const from = running.current
      ? dialog.getBoundingClientRect().height
      : previousHeight.current;
    running.current?.cancel();
    running.current = null;
    dialog.classList.remove("admin-modal-resizing");
    const height = dialog.getBoundingClientRect().height;
    previousHeight.current = height;
    // Let an expanding field drive the natural dialog height, without fixing it mid-transition.
    const fieldIsResizing = Array.from(
      dialog.querySelectorAll(".form-field-message"),
    ).some((message) =>
      message
        .getAnimations?.()
        .some(
          (animation) =>
            "transitionProperty" in animation &&
            (animation.transitionProperty === "height" ||
              animation.transitionProperty === "margin-top"),
        ),
    );
    if (
      fieldIsResizing ||
      from === null ||
      Math.abs(height - from) < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    dialog.classList.add("admin-modal-resizing");
    const animation = dialog.animate(
      [{ height: `${from}px` }, { height: `${height}px` }],
      {
        duration: 360,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    running.current = animation;
    animation.onfinish = () => {
      dialog.classList.remove("admin-modal-resizing");
      running.current = null;
    };
  });
  useLayoutEffect(
    () => () => {
      running.current?.cancel();
    },
    [],
  );
}
