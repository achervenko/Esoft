import {
  useEffect,
  useRef,
  type RefObject,
} from "react";

import type { PdfSearchMatch } from "./usePdfSearch";

type UsePdfActiveMatchOptions = {
  activeMatch?: PdfSearchMatch;
  pageElements: RefObject<Array<HTMLDivElement | null>>;
  documentScrollElement: RefObject<HTMLDivElement | null>;
  onPageChange: (pageNumber: number) => void;
};

export function usePdfActiveMatch({
  activeMatch,
  pageElements,
  documentScrollElement,
  onPageChange,
}: UsePdfActiveMatchOptions) {
  const activeMatchElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!activeMatch) {
      activeMatchElement.current?.classList.remove(
        "pdf-preview-search-match-active",
      );

      activeMatchElement.current = null;
      return;
    }

    const scrollElement = documentScrollElement.current;
    const pageElement =
      pageElements.current[activeMatch.pageNumber - 1];

    if (!scrollElement || !pageElement) {
      return;
    }

    onPageChange(activeMatch.pageNumber);

    let animationFrameId = 0;
    let attempt = 0;
    let isCancelled = false;

    const maxAttempts = 20;

    const scrollToActiveMatch = () => {
      if (isCancelled) {
        return;
      }

      const activeElement =
        pageElement.querySelector<HTMLElement>(
          [
            ".pdf-preview-search-match",
            `[data-page-number="${activeMatch.pageNumber}"]`,
            `[data-item-index="${activeMatch.itemIndex}"]`,
            `[data-occurrence-index="${activeMatch.occurrenceIndex}"]`,
          ].join(""),
        );

      if (!activeElement) {
        attempt += 1;

        if (attempt < maxAttempts) {
          animationFrameId = window.requestAnimationFrame(
            scrollToActiveMatch,
          );
        }

        return;
      }

      activeMatchElement.current?.classList.remove(
        "pdf-preview-search-match-active",
      );

      activeElement.classList.add(
        "pdf-preview-search-match-active",
      );

      activeMatchElement.current = activeElement;

      const scrollRect = scrollElement.getBoundingClientRect();
      const matchRect = activeElement.getBoundingClientRect();

      const toolbarOffset = 52;

      const isVisibleVertically =
        matchRect.top >= scrollRect.top + toolbarOffset &&
        matchRect.bottom <= scrollRect.bottom;

      const isVisibleHorizontally =
        matchRect.left >= scrollRect.left &&
        matchRect.right <= scrollRect.right;

      if (isVisibleVertically && isVisibleHorizontally) {
        return;
      }

      const targetTop =
        scrollElement.scrollTop +
        matchRect.top -
        scrollRect.top -
        scrollElement.clientHeight / 2 +
        matchRect.height / 2;

      const targetLeft =
        scrollElement.scrollLeft +
        matchRect.left -
        scrollRect.left -
        scrollElement.clientWidth / 2 +
        matchRect.width / 2;

      scrollElement.scrollTo({
        top: Math.max(0, targetTop),
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
    };

    animationFrameId = window.requestAnimationFrame(
      scrollToActiveMatch,
    );

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationFrameId);

      activeMatchElement.current?.classList.remove(
        "pdf-preview-search-match-active",
      );

      activeMatchElement.current = null;
    };
  }, [
    activeMatch,
    documentScrollElement,
    onPageChange,
    pageElements,
  ]);
}
