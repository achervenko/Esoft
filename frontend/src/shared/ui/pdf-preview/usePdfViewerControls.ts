import {
  useCallback,
  useState,
  type RefObject,
} from "react";

type UsePdfViewerControlsOptions = {
  numberOfPages: number;
  pageElements: RefObject<Array<HTMLDivElement | null>>;
};

const normalizeScale = (value: number) =>
  Math.round(value * 10) / 10;

export function usePdfViewerControls({
  numberOfPages,
  pageElements,
}: UsePdfViewerControlsOptions) {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const changeCurrentPage = useCallback(
    (page: number) => {
      if (numberOfPages === 0) {
        return;
      }

      const nextPage = Math.min(
        Math.max(page, 1),
        numberOfPages,
      );

      setCurrentPage(nextPage);

      pageElements.current[nextPage - 1]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [numberOfPages, pageElements],
  );

  const zoomOut = useCallback(() => {
    setScale((currentScale) =>
      Math.max(0.5, normalizeScale(currentScale - 0.1)),
    );
  }, []);

  const zoomIn = useCallback(() => {
    setScale((currentScale) =>
      Math.min(3, normalizeScale(currentScale + 0.1)),
    );
  }, []);

  const changeScale = useCallback((nextScale: number) => {
    setScale(
      Math.min(3, Math.max(0.5, normalizeScale(nextScale))),
    );
  }, []);

  const rotate = useCallback(() => {
    setRotation(
      (currentRotation) => (currentRotation + 90) % 360,
    );
  }, []);

  const resetControls = useCallback(() => {
    setCurrentPage(1);
    setScale(1);
    setRotation(0);
  }, []);

  return {
    currentPage,
    scale,
    rotation,
    setCurrentPage,
    setScale,
    changeCurrentPage,
    changeScale,
    zoomIn,
    zoomOut,
    rotate,
    resetControls,
  };
}
