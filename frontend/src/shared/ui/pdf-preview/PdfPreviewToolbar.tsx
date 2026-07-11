import { RotateDirection } from "@react-pdf-viewer/core";
import type { ToolbarProps } from "@react-pdf-viewer/default-layout";
import { Download, Minus, Plus, Printer, RotateCw } from "lucide-react";
import type React from "react";
import { pdfPreviewText } from "./pdf-preview.text";

type PdfPreviewToolbarProps = {
  isDownloading: boolean;
  isPrinting: boolean;
  onDownload: () => void;
  onPrint: () => void;
  Toolbar: (props: ToolbarProps) => React.ReactElement;
};

export function PdfPreviewToolbar({
  isDownloading,
  isPrinting,
  onDownload,
  onPrint,
  Toolbar,
}: PdfPreviewToolbarProps) {
  return (
    <Toolbar>
      {(slots) => (
        <div className="pdf-preview-viewer-toolbar">
          <div className="pdf-preview-toolbar-cluster">
            <div className="pdf-preview-page-control">
              <slots.CurrentPageInput />
              <span className="pdf-preview-pages-separator">/</span>
              <slots.NumberOfPages>
                {({ numberOfPages }) => (
                  <span className="pdf-preview-total-pages">
                    {numberOfPages}
                  </span>
                )}
              </slots.NumberOfPages>
            </div>

            <slots.ZoomOut>
              {({ onClick }) => (
                <button
                  aria-label={pdfPreviewText.zoomOut}
                  className="pdf-preview-tool-button"
                  onClick={onClick}
                  type="button"
                >
                  <Minus aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
              )}
            </slots.ZoomOut>

            <slots.CurrentScale>
              {({ scale }) => (
                <span className="pdf-preview-scale">
                  {Math.round(scale * 100)}%
                </span>
              )}
            </slots.CurrentScale>

            <slots.ZoomIn>
              {({ onClick }) => (
                <button
                  aria-label={pdfPreviewText.zoomIn}
                  className="pdf-preview-tool-button"
                  onClick={onClick}
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
              )}
            </slots.ZoomIn>

            <slots.Rotate direction={RotateDirection.Forward}>
              {({ onClick }) => (
                <button
                  aria-label={pdfPreviewText.rotate}
                  className="pdf-preview-tool-button"
                  onClick={onClick}
                  type="button"
                >
                  <RotateCw aria-hidden="true" size={16} strokeWidth={2.1} />
                </button>
              )}
            </slots.Rotate>

            <button
              aria-label={pdfPreviewText.print}
              className="pdf-preview-tool-button"
              disabled={isPrinting}
              onClick={onPrint}
              type="button"
            >
              <Printer aria-hidden="true" size={16} strokeWidth={2.1} />
            </button>

            <button
              aria-label={pdfPreviewText.download}
              className="pdf-preview-tool-button pdf-preview-toolbar-download"
              disabled={isDownloading}
              onClick={onDownload}
              type="button"
            >
              <Download aria-hidden="true" size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </Toolbar>
  );
}
