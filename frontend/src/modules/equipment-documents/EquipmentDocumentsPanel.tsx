import { Save } from "lucide-react";
import { Notice } from "../../shared/ui/Notice";
import { PdfPreviewModal } from "../../shared/ui/PdfPreviewModal";
import { UnsavedChangesGuard } from "../../shared/ui/UnsavedChangesGuard";
import { EquipmentDocumentTypeSection } from "./EquipmentDocumentTypeSection";
import { getDisplayName } from "./equipment-document-utils";
import {
  documentTypeOptions,
  equipmentDocumentsText as text,
} from "./equipment-documents.text";
import { useEquipmentDocumentsPanel } from "./useEquipmentDocumentsPanel";
import "./EquipmentDocumentsPanel.css";

type EquipmentDocumentsPanelProps = {
  mode: "edit" | "view";
  onSaved?: () => void;
  visibleId: number;
};

export function EquipmentDocumentsPanel({
  mode,
  onSaved,
  visibleId,
}: EquipmentDocumentsPanelProps) {
  const panel = useEquipmentDocumentsPanel({ onSaved, visibleId });

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

      <PdfPreviewModal
        fileId={panel.previewFile?.id ?? null}
        fileName={panel.previewFile ? getDisplayName(panel.previewFile) : ""}
        onClose={() => panel.setPreviewFile(null)}
        open={Boolean(panel.previewFile)}
      />
    </section>
  );
}
