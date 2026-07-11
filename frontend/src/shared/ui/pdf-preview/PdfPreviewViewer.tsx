import { Viewer, Worker } from "@react-pdf-viewer/core";
import type { ToolbarProps } from "@react-pdf-viewer/default-layout";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import type React from "react";
import { useCallback } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { pdfPreviewLocalization } from "./pdf-preview-localization";
import { PdfPreviewToolbar } from "./PdfPreviewToolbar";

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
  const renderToolbar = useCallback(
    (Toolbar: (props: ToolbarProps) => React.ReactElement) => (
      <PdfPreviewToolbar
        isDownloading={isDownloading}
        isPrinting={isPrinting}
        onDownload={onDownload}
        onPrint={onPrint}
        Toolbar={Toolbar}
      />
    ),
    [isDownloading, isPrinting, onDownload, onPrint],
  );

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    renderToolbar,
    sidebarTabs: () => [],
    toolbarPlugin: {
      printPlugin: {
        enableShortcuts: false,
      },
    },
  });

  return (
    <Worker workerUrl={pdfWorkerUrl}>
      <Viewer
        fileUrl={fileUrl}
        localization={pdfPreviewLocalization}
        plugins={[defaultLayoutPluginInstance]}
      />
    </Worker>
  );
}
