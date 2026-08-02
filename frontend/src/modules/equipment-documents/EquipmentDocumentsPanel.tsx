import {
  Component,
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Save } from "lucide-react";
import { Notice } from "../../shared/ui/Notice";
import { UnsavedChangesGuard } from "../../shared/ui/UnsavedChangesGuard";
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
    <div
      className="equipment-documents-pdf-preview-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-label={fileName || "PDF"}
        aria-modal="true"
        className="equipment-documents-pdf-preview-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="equipment-documents-pdf-preview-header">
          <div className="equipment-documents-pdf-preview-title">
            <span>{fileName || "PDF"}</span>
          </div>

          <button
            aria-label="Закрыть"
            className="equipment-documents-pdf-preview-close"
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
  const panel = useEquipmentDocumentsPanel({ onSaved, visibleId });
  const previewFileName = panel.previewFile
    ? getDisplayName(panel.previewFile)
    : "";

  return (
    <section className="equipment-documents-panel">
      {mode === "edit" ? (
        <UnsavedChangesGuard hasChanges={panel.hasUnsavedDocumentChanges} />
      ) : null}

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
              isUploading={Boolean(panel.uploadingDocumentType)}
              key={option.value}
              mode={mode}
              onDelete={panel.handleDelete}
              onDownload={(file) => void panel.handleDownload(file)}
              onFileChange={panel.handleFileChange}
              onOpenPreview={panel.setPreviewFile}
              onSetPrimary={(file) => void panel.handleSetPrimary(file)}
              selectedFile={panel.selectedFiles[option.value] ?? null}
              settingPrimaryFileId={panel.settingPrimaryFileId}
              title={option.label}
              visibleId={visibleId}
            />
          ))
        : null}

      {mode === "edit" &&
      !panel.isLoading &&
      panel.hasUnsavedDocumentChanges ? (
        <form
          className="equipment-form-actions"
          onSubmit={(event) => void panel.handleSaveChanges(event)}
        >
          <button
            className="equipment-submit-button"
            disabled={Boolean(panel.uploadingDocumentType)}
            type="submit"
          >
            <Save aria-hidden="true" size={18} />
            <span>
              {panel.uploadingDocumentType ? text.saving : text.saveChanges}
            </span>
          </button>
        </form>
      ) : null}

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
