import { pdfjs } from "react-pdf";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { PdfPreviewDocument } from "./PdfPreviewDocument";
import { PdfPreviewSearch } from "./PdfPreviewSearch";
import { PdfPreviewToolbar } from "./PdfPreviewToolbar";
import { usePdfSearch } from "./usePdfSearch";
import { usePdfViewer } from "./usePdfViewer";

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
  const search = usePdfSearch();

  const viewer = usePdfViewer({
    activeMatch: search.activeMatch,
    fileUrl,
    indexDocument: search.indexDocument,
    renderText: search.renderText,
    resetSearch: search.resetSearch,
  });

  return (
    <div className="pdf-preview-viewer">
      <PdfPreviewToolbar
        currentPage={viewer.currentPage}
        isDownloading={isDownloading}
        isPrinting={isPrinting}
        numberOfPages={viewer.numberOfPages}
        onCurrentPageChange={viewer.changeCurrentPage}
        onDownload={onDownload}
        onPrint={onPrint}
        onRotate={viewer.rotate}
        onScaleChange={viewer.changeScale}
        onZoomIn={viewer.zoomIn}
        onZoomOut={viewer.zoomOut}
        scale={viewer.scale}
      />

      <PdfPreviewSearch
        activeMatchIndex={search.activeMatchIndex}
        inputRef={search.inputRef}
        isDisabled={viewer.numberOfPages === 0}
        isIndexLoading={search.isIndexLoading}
        isOpen={search.isOpen}
        matchCount={search.matches.length}
        onClose={search.closeSearch}
        onKeyDown={search.handleInputKeyDown}
        onNext={search.goToNextMatch}
        onPrevious={search.goToPreviousMatch}
        onQueryChange={search.setQuery}
        query={search.query}
      />

      <PdfPreviewDocument
        documentScrollRef={viewer.documentScrollRef}
        fileUrl={fileUrl}
        numberOfPages={viewer.numberOfPages}
        onDocumentLoadSuccess={
          viewer.handleDocumentLoadSuccess
        }
        onFirstPageLoadSuccess={
          viewer.handleFirstPageLoadSuccess
        }
        pageRefs={viewer.pageRefs}
        pageTextRenderers={viewer.pageTextRenderers}
        rotation={viewer.rotation}
        scale={viewer.scale}
      />
    </div>
  );
}
