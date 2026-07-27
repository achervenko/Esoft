import { useEffect, type RefObject } from "react";

type UsePdfPageObserverOptions = {
  numberOfPages: number;
  rotation: number;
  scale: number;
  pageElements: RefObject<Array<HTMLDivElement | null>>;
  documentScrollElement: RefObject<HTMLDivElement | null>;
  onPageChange: (pageNumber: number) => void;
};

export function usePdfPageObserver({
  numberOfPages,
  rotation,
  scale,
  pageElements,
  documentScrollElement,
  onPageChange,
}: UsePdfPageObserverOptions) {
  useEffect(() => {
    const scrollElement = documentScrollElement.current;

    if (!scrollElement || numberOfPages === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (firstEntry, secondEntry) =>
              secondEntry.intersectionRatio -
              firstEntry.intersectionRatio,
          )[0];

        if (!mostVisibleEntry) {
          return;
        }

        const pageNumber = Number(
          mostVisibleEntry.target.getAttribute(
            "data-page-number",
          ),
        );

        if (
          Number.isInteger(pageNumber) &&
          pageNumber >= 1 &&
          pageNumber <= numberOfPages
        ) {
          onPageChange(pageNumber);
        }
      },
      {
        root: scrollElement,
        threshold: [0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    const elements = pageElements.current.filter(
      (element): element is HTMLDivElement =>
        element !== null,
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [
    documentScrollElement,
    numberOfPages,
    onPageChange,
    pageElements,
    rotation,
    scale,
  ]);
}
