import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useModalResizeAnimation } from "../../shared/ui/useModalResizeAnimation";
import { Notice } from "../../shared/ui/Notice";
import type { StorageDocumentType } from "../../shared/api/equipment-files/equipment-files.types";
import { EquipmentDocumentUploadForm } from "./EquipmentDocumentUploadForm";
import { EquipmentDocumentTypeSection } from "./EquipmentDocumentTypeSection";
import { getDisplayName } from "./equipment-document-utils";
import {
  documentTypeOptions,
  equipmentDocumentsText as text,
} from "./equipment-documents.text";
import { useEquipmentDocumentsPanel } from "./useEquipmentDocumentsPanel";
import "./EquipmentDocumentsPanel.css";

function lazyNamedComponent<TProps>(
  loadComponent: () => Promise<ComponentType<TProps>>,
) {
  return lazy(async () => ({
    default: await loadComponent(),
  }));
}

const PdfPreviewModal = lazyNamedComponent(() =>
  import("../../shared/ui/pdf-preview/PdfPreviewModal").then(
    (module) => module.PdfPreviewModal,
  ),
);

type EquipmentDocumentsPanelProps = {
  mode: "edit" | "view";
  onSaved?: () => void;
  visibleId: number;
};

type PdfPreviewLazyBoundaryProps = {
  children: ReactNode;
  fileName: string;
  onClose: () => void;
};

type PdfPreviewLazyBoundaryState = {
  hasError: boolean;
};

class PdfPreviewLazyBoundary extends Component<
  PdfPreviewLazyBoundaryProps,
  PdfPreviewLazyBoundaryState
> {
  state: PdfPreviewLazyBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <PdfPreviewModalFallback
          fileName={this.props.fileName}
          message="Не удалось открыть просмотр PDF."
          onClose={this.props.onClose}
          tone="error"
        />
      );
    }

    return this.props.children;
  }
}

type PdfPreviewModalFallbackProps = {
  fileName: string;
  message: string;
  onClose: () => void;
  tone?: "error" | "loading";
};

function PdfPreviewModalFallback({
  fileName,
  message,
  onClose,
  tone = "loading",
}: PdfPreviewModalFallbackProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalResizeAnimation(dialogRef);
  useEffect(() => {
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
  }, [onClose]);

  return createPortal(
    <div className="pdf-preview-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label={fileName || "PDF"}
        aria-modal="true"
        className="pdf-preview-modal"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="pdf-preview-header">
          <div className="pdf-preview-title">
            <span>{fileName || "PDF"}</span>
          </div>

          <button
            aria-label="Закрыть"
            className="pdf-preview-close pdf-preview-close-text"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div
          className={
            tone === "error"
              ? "equipment-documents-pdf-preview-state equipment-documents-pdf-preview-state-error"
              : "equipment-documents-pdf-preview-state"
          }
          role={tone === "error" ? "alert" : "status"}
        >
          {message}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function EquipmentDocumentsPanel({
  mode,
  onSaved,
  visibleId,
}: EquipmentDocumentsPanelProps) {
  const panel = useEquipmentDocumentsPanel({ visibleId });
  const [upload, setUpload] = useState<{
    visibleId: number;
    type: StorageDocumentType;
  } | null>(null);
  const uploadOption =
    upload?.visibleId === visibleId &&
    documentTypeOptions.find((option) => option.value === upload.type);
  const previewFileName = panel.previewFile
    ? getDisplayName(panel.previewFile)
    : "";

  return (
    <section className="equipment-documents-panel">
      {panel.error ? <Notice tone="error">{panel.error}</Notice> : null}

      {panel.isLoading ? (
        <section className="equipment-documents-list-section">
          <p className="equipment-documents-muted">{text.loading}</p>
        </section>
      ) : null}

      {!panel.isLoading && mode === "view" && panel.files.length === 0 ? (
        <section className="equipment-documents-list-section">
          <div className="equipment-documents-empty">
            <p>{text.emptyView}</p>
          </div>
        </section>
      ) : null}

      {!panel.isLoading
        ? documentTypeOptions.map((option) => (
            <EquipmentDocumentTypeSection
              deletingFileId={panel.deletingFileId}
              documentType={option.value}
              downloadingFileId={panel.downloadingFileId}
              files={panel.filesByDocumentType[option.value]}
              key={option.value}
              mode={mode}
              onDelete={panel.handleDelete}
              onDownload={(file) => void panel.handleDownload(file)}
              onAddFiles={(type) => setUpload({ visibleId, type })}
              onOpenPreview={panel.setPreviewFile}
              onSetPrimary={(file) => void panel.handleSetPrimary(file)}
              settingPrimaryFileId={panel.settingPrimaryFileId}
              title={option.label}
              visibleId={visibleId}
            />
          ))
        : null}

      {mode === "edit" && uploadOption && (
        <EquipmentDocumentUploadForm
          key={visibleId}
          documentType={uploadOption.value}
          existingFiles={panel.files}
          onClose={() => setUpload(null)}
          onUploaded={(files, complete) => {
            panel.addUploadedFiles(visibleId, files);
            if (complete) onSaved?.();
          }}
          title={uploadOption.label}
          visibleId={visibleId}
        />
      )}

      {panel.previewFile ? (
        <PdfPreviewLazyBoundary
          fileName={previewFileName}
          onClose={() => panel.setPreviewFile(null)}
        >
          <Suspense
            fallback={
              <PdfPreviewModalFallback
                fileName={previewFileName}
                message="Загрузка просмотра..."
                onClose={() => panel.setPreviewFile(null)}
              />
            }
          >
            <PdfPreviewModal
              fileId={panel.previewFile.id}
              fileName={previewFileName}
              onClose={() => panel.setPreviewFile(null)}
              open
              visibleId={visibleId}
            />
          </Suspense>
        </PdfPreviewLazyBoundary>
      ) : null}
    </section>
  );
}
