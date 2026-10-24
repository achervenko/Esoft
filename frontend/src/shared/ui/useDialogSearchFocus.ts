import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../lib/useMediaQuery";

/** Focus a newly mounted search; let mobile dialogs coordinate keyboard scrolling. */
export function useDialogSearchFocus(enabled: boolean) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const frame = useRef<number | null>(null);
  const [ready, setReady] = useState(!enabled);
  const ref = useCallback(
    (input: HTMLInputElement | null) => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (!input || !enabled) return;
      setReady(false);
      input.focus({ preventScroll: true });
      const form = input.closest("form");
      if (form && (!isMobile || !window.visualViewport)) {
        const rect = input.getBoundingClientRect();
        form.scrollTop +=
          rect.top -
          form.getBoundingClientRect().top -
          (form.clientHeight - rect.height) / 2;
      }
      let lastTop = input.getBoundingClientRect().top;
      let stableSince = performance.now();
      const check = (now: number) => {
        if (!input.isConnected) {
          frame.current = null;
          return;
        }
        const top = input.getBoundingClientRect().top;
        if (Math.abs(top - lastTop) > 0.5) stableSince = now;
        lastTop = top;
        if (now - stableSince >= 80) {
          frame.current = null;
          setReady(true);
        } else frame.current = requestAnimationFrame(check);
      };
      frame.current = requestAnimationFrame(check);
    },
    [enabled, isMobile],
  );
  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    },
    [],
  );
  return { ref, ready: !enabled || ready };
}
