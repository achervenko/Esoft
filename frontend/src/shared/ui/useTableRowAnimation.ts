import { useEffect, useLayoutEffect, useRef } from "react";

export function useTableRowAnimation(
  rows: readonly unknown[],
  enabled: boolean,
) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const positions = useRef(new Map<string, number>());
  const animations = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !enabled) {
      positions.current.clear();
      return;
    }
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    const next = new Map<string, number>();
    const origin = body.getBoundingClientRect().top;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    for (const row of Array.from(body.rows)) {
      const key = row.dataset.rowKey;
      if (key === undefined) continue;
      const top = row.getBoundingClientRect().top - origin;
      const previous = positions.current.get(key);
      next.set(key, top);
      if (
        enabled &&
        !reducedMotion &&
        previous !== undefined &&
        previous !== top &&
        typeof row.animate === "function"
      ) {
        animations.current.push(
          row.animate(
            [
              { transform: `translateY(${previous - top}px)` },
              { transform: "translateY(0)" },
            ],
            { duration: 650, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
          ),
        );
      }
    }
    positions.current = next;
  }, [rows, enabled]);

  useEffect(
    () => () => {
      animations.current.forEach((animation) => animation.cancel());
    },
    [],
  );
  return bodyRef;
}
