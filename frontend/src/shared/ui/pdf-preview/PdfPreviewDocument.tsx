import { useEffect, useState, type RefObject } from "react";
import { Document, Page } from "react-pdf";

import type {
  PdfDocumentForViewer,
  PdfPageForViewer,
  TextRendererParams,
} from "./pdfPreview.types";

type PdfPreviewDocumentProps = {
  fileUrl: string;
  numberOfPages: number;
  currentPage: number;

  scale: number;
  rotation: number;

  documentScrollRef: RefObject<HTMLDivElement | null>;
  pageRefs: RefObject<Array<HTMLDivElement | null>>;

  pageTextRenderers: ReadonlyArray<
    (params: TextRendererParams) => string
  >;

  onDocumentLoadSuccess: (
    pdfDocument: PdfDocumentForViewer,
  ) => void;

  onFirstPageLoadSuccess: (
    page: PdfPageForViewer,
  ) => void;
};

export function PdfPreviewDocument({
  fileUrl,
  numberOfPages,
  currentPage,
  scale,
  rotation,
  documentScrollRef,
  pageRefs,
  pageTextRenderers,
  onDocumentLoadSuccess,
  onFirstPageLoadSuccess,
}: PdfPreviewDocumentProps) {
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({});
  useEffect(() => { setSizes({}); }, [fileUrl]);
  const defaultSize = sizes[1] ?? { width: 612, height: 792 };
  return (
    <div
      className="pdf-preview-document-scroll"
      ref={documentScrollRef}
    >
      <Document
        file={fileUrl}
        loading={
          <div className="pdf-preview-state">
            Загрузка документа...
          </div>
        }
        onLoadSuccess={onDocumentLoadSuccess}
      >
        <div className="pdf-preview-pages">
          {Array.from(
            { length: numberOfPages },
            (_, index) => {
              const pageNumber = index + 1;
              const size = sizes[pageNumber] ?? defaultSize;
              const turned = rotation % 180 !== 0;
              const width = (turned ? size.height : size.width) * scale;
              const height = (turned ? size.width : size.height) * scale;
              const mounted = Math.abs(pageNumber - currentPage) <= 2;

              return (
                <div
                  className="pdf-preview-page"
                  data-page-number={pageNumber}
                  key={pageNumber}
                  style={{ width, height, background: 'white' }}
                  ref={(element) => {
                    pageRefs.current[index] = element;
                  }}
                >
                  {mounted ? <Page
                    customTextRenderer={
                      pageTextRenderers[index]
                    }
                    onLoadSuccess={(page) => {
                      const viewport = page.getViewport({ scale: 1, rotation: 0 });
                      setSizes((current) => {
                        if (current[pageNumber]?.width === viewport.width && current[pageNumber]?.height === viewport.height) return current;
                        return { ...current, [pageNumber]: { width: viewport.width, height: viewport.height } };
                      });
                      if (pageNumber === 1) onFirstPageLoadSuccess(page);
                    }}
                    devicePixelRatio={Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(4000000 / Math.max(1, width * height)))}
                    pageNumber={pageNumber}
                    renderAnnotationLayer
                    renderTextLayer
                    rotate={rotation}
                    scale={scale}
                  /> : null}
                </div>
              );
            },
          )}
        </div>
      </Document>
    </div>
  );
}
