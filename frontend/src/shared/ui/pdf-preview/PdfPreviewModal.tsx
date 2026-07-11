import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/print/lib/styles/index.css";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { downloadFileById } from "../../api/files-api";
import "./PdfPreviewModal.css";
import { pdfPreviewText } from "./pdf-preview.text";
import { printPdfUrl } from "./pdf-preview-print";
import { PdfPreviewViewer } from "./PdfPreviewViewer";
import { usePdfPreview } from "./usePdfPreview";

type PdfPreviewModalProps = {
  fileId: number | null;
  fileName: string;
  onClose: () => void;
  open: boolean;
};

export function PdfPreviewModal({
  fileId,
  fileName,
  onClose,
  open,
}: PdfPreviewModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const resolvedFileName = fileName || pdfPreviewText.unnamed;
  const { error, fileUrl, isLoading, loadPreview, setError } = usePdfPreview({
    fileId,
    open,
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const handleDownload = useCallback(async () => {
    if (!fileId) {
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      await downloadFileById({
        fileId,
        fileName: resolvedFileName,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : pdfPreviewText.error,
      );
    } finally {
      setIsDownloading(false);
    }
  }, [fileId, resolvedFileName, setError]);

  const handlePrint = useCallback(async () => {
    if (!fileUrl) {
      return;
    }

    setIsPrinting(true);
    setError(null);

    try {
      await printPdfUrl(fileUrl);
    } catch {
      setError(pdfPreviewText.printError);
    } finally {
      setIsPrinting(false);
    }
  }, [fileUrl, setError]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="pdf-preview-backdrop" role="presentation">
      <section
        aria-label={resolvedFileName}
        aria-modal="true"
        className="pdf-preview-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="pdf-preview-header">
          <div className="pdf-preview-title">
            <span>{resolvedFileName}</span>
          </div>

          <button
            aria-label={pdfPreviewText.close}
            className="pdf-preview-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="pdf-preview-body">
          {isLoading ? (
            <div className="pdf-preview-state">{pdfPreviewText.loading}</div>
          ) : null}

          {error ? (
            <div className="pdf-preview-state pdf-preview-state-error">
              <p>{error}</p>
              <button onClick={loadPreview} type="button">
                {pdfPreviewText.retry}
              </button>
            </div>
          ) : null}

          {!isLoading && !error && fileUrl ? (
            <PdfPreviewViewer
              fileUrl={fileUrl}
              isDownloading={isDownloading}
              isPrinting={isPrinting}
              onDownload={handleDownload}
              onPrint={handlePrint}
            />
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
