import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getGridWindow, type GridLayout } from "./windowed-grid";

export function useWindowedGrid<Element extends HTMLElement = HTMLDivElement>(
  count: number,
) {
  const gridRef = useRef<Element>(null);
  const [layout, setLayout] = useState<GridLayout>({
    columns: 1,
    gap: 18,
    estimatedHeight: 450,
    rowHeights: {},
    scrollTop: 0,
    viewportHeight: 800,
  });
  const range = getGridWindow(count, layout);
  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || !grid.getBoundingClientRect().width) return;
    const style = getComputedStyle(grid);
    const columns = Math.max(
      1,
      style.gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    const gap = parseFloat(style.rowGap) || 0;
    let scroller: HTMLElement | null = grid.parentElement;
    while (
      scroller &&
      (!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) ||
        scroller.scrollHeight <= scroller.clientHeight)
    )
      scroller = scroller.parentElement;
    const bounds = grid.getBoundingClientRect();
    const scrollTop = Math.max(
      0,
      (scroller?.getBoundingClientRect().top ?? 0) - bounds.top,
    );
    const viewportHeight = scroller?.clientHeight ?? window.innerHeight;
    const measured: Record<number, number> = {};
    grid.querySelectorAll<HTMLElement>("[data-grid-index]").forEach((card) => {
      const row = Math.floor(Number(card.dataset.gridIndex) / columns);
      measured[row] = Math.max(
        measured[row] ?? 0,
        card.getBoundingClientRect().height,
      );
    });
    setLayout((previous) => {
      const rowHeights = {
        ...(previous.columns === columns ? previous.rowHeights : {}),
        ...measured,
      };
      // Keep the estimate stable while scrolling; one taller row must not resize every unseen row.
      const estimatedHeight =
        previous.columns !== columns || !Object.keys(previous.rowHeights).length
          ? Object.values(measured)[0] || previous.estimatedHeight
          : previous.estimatedHeight;
      if (
        previous.columns === columns &&
        previous.gap === gap &&
        previous.scrollTop === scrollTop &&
        previous.viewportHeight === viewportHeight &&
        previous.estimatedHeight === estimatedHeight &&
        Object.entries(measured).every(
          ([row, height]) => previous.rowHeights[Number(row)] === height,
        )
      )
        return previous;
      return {
        columns,
        gap,
        estimatedHeight,
        rowHeights,
        scrollTop,
        viewportHeight,
      };
    });
  }, []);
  useLayoutEffect(measure, [measure, count, range.start, range.end]);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(grid);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [measure]);
  return { gridRef, ...range };
}
