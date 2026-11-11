import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getGridWindow } from "../../shared/lib/windowed-grid";
import type { Reservation } from "../../shared/api/warehouse-reservations-api";

const estimate = 96;
type Range = ReturnType<typeof getGridWindow>;
const initialRange = (count: number) =>
  getGridWindow(count, {
    columns: 1,
    gap: 0,
    estimatedHeight: estimate,
    rowHeights: {},
    scrollTop: 0,
    viewportHeight: 600,
  });

// Preserve the first visible row when measured rows above it shrink or grow.
export function reservationScrollAnchor(
  previous: number[],
  next: number[],
  scrollTop: number,
) {
  let before = 0;
  let after = 0;
  for (let i = 0; i < Math.min(previous.length, next.length); i++) {
    if (before + previous[i] > scrollTop) break;
    before += previous[i];
    after += next[i];
  }
  return Math.max(0, scrollTop + after - before);
}

export function useReservationWindow(
  items: Reservation[],
  expanded: ReadonlySet<string>,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, number>());
  const previous = useRef<{
    ids: string[];
    heights: number[];
    width: number;
  } | null>(null);
  const keys = useMemo(
    () => items.map((r) => `${r.id}:${expanded.has(r.id)}`),
    [items, expanded],
  );
  const [range, setRange] = useState<Range>(() =>
    getGridWindow(items.length, {
      columns: 1,
      gap: 0,
      estimatedHeight: estimate,
      rowHeights: {},
      scrollTop: 0,
      viewportHeight: 600,
    }),
  );
  const measure = useCallback(() => {
    const scroller = scrollRef.current;
    const grid = gridRef.current;
    if (!scroller || !grid || !scroller.clientWidth) return;
    const width = scroller.clientWidth;
    if (previous.current?.width !== width) cache.current.clear();
    grid.querySelectorAll<HTMLElement>("[data-grid-index]").forEach((node) => {
      const key = keys[Number(node.dataset.gridIndex)];
      if (key) cache.current.set(key, node.getBoundingClientRect().height);
    });
    const heights = keys.map((key) => cache.current.get(key) ?? estimate);
    const old = previous.current;
    let scrollTop = scroller.scrollTop;
    if (old?.width === width && old.ids.every((id, i) => items[i]?.id === id)) {
      scrollTop = reservationScrollAnchor(old.heights, heights, scrollTop);
      if (Math.abs(scrollTop - scroller.scrollTop) > 0.5)
        scroller.scrollTop = scrollTop;
    }
    previous.current = { ids: items.map((r) => r.id), heights, width };
    const next = getGridWindow(items.length, {
      columns: 1,
      gap: 0,
      estimatedHeight: estimate,
      rowHeights: Object.fromEntries(heights.map((h, i) => [i, h])),
      scrollTop,
      viewportHeight: scroller.clientHeight,
    });
    setRange((current) =>
      current.start === next.start &&
      current.end === next.end &&
      current.before === next.before &&
      current.after === next.after
        ? current
        : next,
    );
  }, [items, keys]);
  useLayoutEffect(measure, [measure, range.start, range.end]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const scroller = scrollRef.current;
    scroller?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (scroller) observer?.observe(scroller);
    gridRef.current
      ?.querySelectorAll<HTMLElement>("[data-grid-index]")
      .forEach((node) => observer?.observe(node));
    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [measure, range.start, range.end]);
  return {
    scrollRef,
    gridRef,
    ...(range.end === 0 && items.length ? initialRange(items.length) : range),
  };
}
