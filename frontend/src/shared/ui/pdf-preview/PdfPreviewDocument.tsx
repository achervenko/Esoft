import type { RefObject } from "react";
import { Document, Page } from "react-pdf";

import type {
  PdfDocumentForViewer,
  PdfPageForViewer,
  TextRendererParams,
} from "./pdfPreview.types";

type PdfPreviewDocumentProps = {
  fileUrl: string;
  numberOfPages: number;

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
  scale,
  rotation,
  documentScrollRef,
  pageRefs,
  pageTextRenderers,
  onDocumentLoadSuccess,
  onFirstPageLoadSuccess,
}: PdfPreviewDocumentProps) {
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

              return (
                <div
                  className="pdf-preview-page"
                  data-page-number={pageNumber}
                  key={pageNumber}
                  ref={(element) => {
                    pageRefs.current[index] = element;
                  }}
                >
                  <Page
                    customTextRenderer={
                      pageTextRenderers[index]
                    }
                    onLoadSuccess={
                      pageNumber === 1
                        ? onFirstPageLoadSuccess
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
            },
          )}
        </div>
      </Document>
    </div>
  );
}
