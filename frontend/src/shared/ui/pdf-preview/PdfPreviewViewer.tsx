import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { PdfPreviewToolbar } from "./PdfPreviewToolbar";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfPreviewViewerProps = {
  fileUrl: string;
  isDownloading: boolean;
  isPrinting: boolean;
  onDownload: () => void;
  onPrint: () => void;
};

export function PdfPreviewViewer({
  fileUrl,
  isDownloading,
  isPrinting,
  onDownload,
  onPrint,
}: PdfPreviewViewerProps) {
  const [numberOfPages, setNumberOfPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const pageElements = useRef<Array<HTMLDivElement | null>>([]);
  const documentScrollElement = useRef<HTMLDivElement | null>(null);
  const initialScaleApplied = useRef(false);

  useEffect(() => {
    initialScaleApplied.current = false;
    pageElements.current = [];

    setNumberOfPages(0);
    setCurrentPage(1);
    setScale(1);
    setRotation(0);
  }, [fileUrl]);

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
              secondEntry.intersectionRatio - firstEntry.intersectionRatio,
          )[0];

        if (!mostVisibleEntry) {
          return;
        }

        const pageNumber = Number(
          mostVisibleEntry.target.getAttribute("data-page-number"),
        );

        if (
          Number.isInteger(pageNumber) &&
          pageNumber >= 1 &&
          pageNumber <= numberOfPages
        ) {
          setCurrentPage(pageNumber);
        }
      },
      {
        root: scrollElement,
        threshold: [0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    const elements = pageElements.current.filter(
      (element): element is HTMLDivElement => element !== null,
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [numberOfPages, rotation, scale]);

  const handleCurrentPageChange = (page: number) => {
    if (numberOfPages === 0) {
      return;
    }

    const nextPage = Math.min(Math.max(page, 1), numberOfPages);

    setCurrentPage(nextPage);

    pageElements.current[nextPage - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleZoomOut = () => {
    setScale((currentScale) => Math.max(0.5, currentScale - 0.1));
  };

  const handleZoomIn = () => {
    setScale((currentScale) => Math.min(3, currentScale + 0.1));
  };

  const handleScaleChange = (nextScale: number) => {
  setScale(Math.min(3, Math.max(0.5, nextScale)));
  };

  const handleRotate = () => {
    setRotation((currentRotation) => (currentRotation + 90) % 360);
  };

  return (
    <div className="pdf-preview-viewer">
      <PdfPreviewToolbar
        currentPage={currentPage}
        isDownloading={isDownloading}
        isPrinting={isPrinting}
        numberOfPages={numberOfPages}
        onCurrentPageChange={handleCurrentPageChange}
        onDownload={onDownload}
        onPrint={onPrint}
        onRotate={handleRotate}
        onScaleChange={handleScaleChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        scale={scale}
      />

      <div className="pdf-preview-document-scroll" ref={documentScrollElement}>
        <Document
          file={fileUrl}
          loading={
            <div className="pdf-preview-state">Загрузка документа...</div>
          }
          onLoadSuccess={({ numPages }) => {
            setNumberOfPages(numPages);
            setCurrentPage(1);
          }}
        >
          <div className="pdf-preview-pages">
            {Array.from({ length: numberOfPages }, (_, index) => {
              const pageNumber = index + 1;

              return (
                <div
                  className="pdf-preview-page"
                  data-page-number={pageNumber}
                  key={pageNumber}
                  ref={(element) => {
                    pageElements.current[index] = element;
                  }}
                >
                  <Page
                    onLoadSuccess={
                      pageNumber === 1
                        ? (page) => {
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
                          }
                        : undefined
                    }
                    pageNumber={pageNumber}
                    renderAnnotationLayer
                    renderTextLayer
                    rotate={rotation}
                    scale={scale}
                  />
                </div>
              );
            })}
          </div>
        </Document>
      </div>
    </div>
  );
}
