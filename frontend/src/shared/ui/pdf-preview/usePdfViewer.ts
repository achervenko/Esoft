import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  PdfDocumentForViewer,
  PdfPageForViewer,
  TextRendererParams,
} from "./pdfPreview.types";
import { usePdfActiveMatch } from "./usePdfActiveMatch";
import { usePdfPageObserver } from "./usePdfPageObserver";
import type { PdfSearchMatch } from "./usePdfSearch";
import { usePdfViewerControls } from "./usePdfViewerControls";

type UsePdfViewerOptions = {
  searchOpen?: boolean;
  fileUrl: string;
  activeMatch?: PdfSearchMatch;
  resetSearch: () => void;
  indexDocument: (
    pdfDocument: PdfDocumentForViewer,
  ) => Promise<void>;
  renderText: (
    text: string,
    pageNumber: number,
    itemIndex: number,
  ) => string;
};

export function usePdfViewer({
  fileUrl,
  activeMatch,
  resetSearch,
  indexDocument,
  renderText,
  searchOpen = false,
}: UsePdfViewerOptions) {
  const [numberOfPages, setNumberOfPages] = useState(0);
  const [document, setDocument] = useState<PdfDocumentForViewer | null>(null);
  const indexedDocument = useRef<PdfDocumentForViewer | null>(null);

  const pageElements = useRef<Array<HTMLDivElement | null>>([]);
  const documentScrollElement = useRef<HTMLDivElement | null>(null);
  const initialScaleApplied = useRef(false);

  const {
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
  } = usePdfViewerControls({
    numberOfPages,
    pageElements,
  });

  const pageTextRenderers = useMemo(
    () =>
      Array.from(
        { length: numberOfPages },
        (_, pageIndex) => {
          const pageNumber = pageIndex + 1;

          return ({ str, itemIndex }: TextRendererParams) =>
            renderText(str, pageNumber, itemIndex);
        },
      ),
    [numberOfPages, renderText],
  );

  useEffect(() => {
    initialScaleApplied.current = false;
    pageElements.current = [];

    setNumberOfPages(0);
    setDocument(null);
    indexedDocument.current = null;
    resetControls();
    resetSearch();
  }, [fileUrl, resetControls, resetSearch]);

  useEffect(() => {
    if (!searchOpen || !document || indexedDocument.current === document) return;
    indexedDocument.current = document;
    void indexDocument(document);
  }, [document, searchOpen, indexDocument]);

  usePdfActiveMatch({
    activeMatch,
    pageElements,
    documentScrollElement,
    onPageChange: setCurrentPage,
  });

  usePdfPageObserver({
    numberOfPages,
    rotation,
    scale,
    pageElements,
    documentScrollElement,
    onPageChange: setCurrentPage,
  });

  const handleDocumentLoadSuccess = useCallback(
    (pdfDocument: PdfDocumentForViewer) => {
      setNumberOfPages(pdfDocument.numPages);
      setCurrentPage(1);

      setDocument(pdfDocument);
    },
    [setCurrentPage],
  );

  const handleFirstPageLoadSuccess = useCallback(
    (page: PdfPageForViewer) => {
      if (initialScaleApplied.current) {
        return;
      }

      const containerWidth =
        documentScrollElement.current?.clientWidth;

      if (!containerWidth) {
        return;
      }

      const viewport = page.getViewport({
        scale: 1,
      });

      const horizontalPadding = 32;
      const nextScale =
        (containerWidth - horizontalPadding) /
        viewport.width;

      setScale(Math.min(3, Math.max(0.5, nextScale)));
      initialScaleApplied.current = true;
    },
    [setScale],
  );

  return {
    numberOfPages,
    currentPage,
    scale,
    rotation,
    pageRefs: pageElements,
    documentScrollRef: documentScrollElement,
    pageTextRenderers,
    changeCurrentPage,
    changeScale,
    zoomIn,
    zoomOut,
    rotate,
    handleDocumentLoadSuccess,
    handleFirstPageLoadSuccess,
  };
}
