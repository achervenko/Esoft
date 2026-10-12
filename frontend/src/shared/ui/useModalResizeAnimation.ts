import { useLayoutEffect, useRef, type RefObject } from "react";

export function useModalResizeAnimation(
  dialogRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const previousHeight = useRef<number | null>(null);
  const running = useRef<Animation | null>(null);
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
    const from = running.current ? dialog.getBoundingClientRect().height : previousHeight.current;
    running.current?.cancel();
    running.current = null;
    dialog.classList.remove("admin-modal-resizing");
    const height = dialog.getBoundingClientRect().height;
    previousHeight.current = height;
    if (from === null || Math.abs(height - from) < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    dialog.classList.add("admin-modal-resizing");
    const animation = dialog.animate([{ height: `${from}px` }, { height: `${height}px` }], {
      duration: 360,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    running.current = animation;
    animation.onfinish = () => {
      dialog.classList.remove("admin-modal-resizing");
      running.current = null;
    };
  });
  useLayoutEffect(() => () => { running.current?.cancel(); }, []);
}
