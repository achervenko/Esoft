import { useEffect, useState } from "react";
import {
  Download,
  Minus,
  Plus,
  Printer,
  RotateCw,
} from "lucide-react";

import { pdfPreviewText } from "./pdf-preview.text";

const MIN_SCALE_PERCENT = 50;
const MAX_SCALE_PERCENT = 300;

type PdfPreviewToolbarProps = {
  currentPage: number;
  numberOfPages: number;
  scale: number;
  isDownloading: boolean;
  isPrinting: boolean;
  onCurrentPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onRotate: () => void;
  onDownload: () => void;
  onPrint: () => void;
};

export function PdfPreviewToolbar({
  currentPage,
  numberOfPages,
  scale,
  isDownloading,
  isPrinting,
  onCurrentPageChange,
  onScaleChange,
  onZoomOut,
  onZoomIn,
  onRotate,
  onDownload,
  onPrint,
}: PdfPreviewToolbarProps) {
  const [pageInput, setPageInput] = useState(
    String(currentPage),
  );

  const [scaleInput, setScaleInput] = useState(
    `${Math.round(scale * 100)}%`,
  );

  const [isEditingPage, setIsEditingPage] =
    useState(false);

  const [isEditingScale, setIsEditingScale] =
    useState(false);

  useEffect(() => {
    if (!isEditingPage) {
      setPageInput(String(currentPage));
    }
  }, [currentPage, isEditingPage]);

  useEffect(() => {
    if (!isEditingScale) {
      setScaleInput(`${Math.round(scale * 100)}%`);
    }
  }, [scale, isEditingScale]);

  const commitPage = () => {
    const parsedPage = Number(pageInput);

    if (
      !Number.isFinite(parsedPage) ||
      numberOfPages === 0
    ) {
      setPageInput(String(currentPage));
      setIsEditingPage(false);
      return;
    }

    const nextPage = Math.min(
      numberOfPages,
      Math.max(1, Math.round(parsedPage)),
    );

    setPageInput(String(nextPage));
    setIsEditingPage(false);
    onCurrentPageChange(nextPage);
  };

  const commitScale = () => {
    const parsedPercent = Number(
      scaleInput.replace("%", ""),
    );

    if (!Number.isFinite(parsedPercent)) {
      setScaleInput(`${Math.round(scale * 100)}%`);
      setIsEditingScale(false);
      return;
    }

    const nextPercent = Math.min(
      MAX_SCALE_PERCENT,
      Math.max(
        MIN_SCALE_PERCENT,
        Math.round(parsedPercent),
      ),
    );

    setScaleInput(`${nextPercent}%`);
    setIsEditingScale(false);
    onScaleChange(nextPercent / 100);
  };

  return (
    <div className="pdf-preview-viewer-toolbar">
      <div className="pdf-preview-toolbar-cluster">
        <div className="pdf-preview-page-control">
          <input
            aria-label="Текущая страница"
            className="pdf-preview-value-input pdf-preview-page-input"
            inputMode="numeric"
            onBlur={commitPage}
            onChange={(event) => {
              setPageInput(
                event.target.value.replace(/\D/g, ""),
              );
            }}
            onFocus={(event) => {
              setIsEditingPage(true);
              event.target.select();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }

              if (event.key === "Escape") {
                setPageInput(String(currentPage));
                event.currentTarget.blur();
              }
            }}
            type="text"
            value={pageInput}
          />

          <span className="pdf-preview-pages-separator">
            /
          </span>

          <span className="pdf-preview-total-pages">
            {numberOfPages}
          </span>
        </div>

        <button
          aria-label={pdfPreviewText.zoomOut}
          className="pdf-preview-tool-button"
          onClick={onZoomOut}
          type="button"
        >
          <Minus
            aria-hidden="true"
            size={16}
            strokeWidth={2.4}
          />
        </button>

        <input
          aria-label="Масштаб"
          className="pdf-preview-value-input pdf-preview-scale-input"
          inputMode="numeric"
          onBlur={commitScale}
          onChange={(event) => {
            const digits = event.target.value.replace(
              /\D/g,
              "",
            );

            setScaleInput(
              digits.length > 0 ? `${digits}%` : "",
            );
          }}
          onFocus={(event) => {
            setIsEditingScale(true);
            event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              setScaleInput(
                `${Math.round(scale * 100)}%`,
              );
              event.currentTarget.blur();
            }
          }}
          type="text"
          value={scaleInput}
        />

        <button
          aria-label={pdfPreviewText.zoomIn}
          className="pdf-preview-tool-button"
          onClick={onZoomIn}
          type="button"
        >
          <Plus
            aria-hidden="true"
            size={16}
            strokeWidth={2.4}
          />
        </button>

        <button
          aria-label={pdfPreviewText.rotate}
          className="pdf-preview-tool-button"
          onClick={onRotate}
          type="button"
        >
          <RotateCw
            aria-hidden="true"
            size={16}
            strokeWidth={2.1}
          />
        </button>

        <button
          aria-label={pdfPreviewText.print}
          className="pdf-preview-tool-button"
          disabled={isPrinting}
          onClick={onPrint}
          type="button"
        >
          <Printer
            aria-hidden="true"
            size={16}
            strokeWidth={2.1}
          />
        </button>

        <button
          aria-label={pdfPreviewText.download}
          className="pdf-preview-tool-button pdf-preview-toolbar-download"
          disabled={isDownloading}
          onClick={onDownload}
          type="button"
        >
          <Download
            aria-hidden="true"
            size={16}
            strokeWidth={2.2}
          />
        </button>
      </div>
    </div>
  );
}