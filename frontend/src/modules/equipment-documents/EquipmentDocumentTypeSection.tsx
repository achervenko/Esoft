import { useEffect, useId, useRef } from "react";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-api";
import { EquipmentDocumentListItem } from "./EquipmentDocumentListItem";
import { EquipmentDocumentUploadForm } from "./EquipmentDocumentUploadForm";

type EquipmentDocumentTypeSectionProps = {
  deletingFileId: number | null;
  documentType: StorageDocumentType;
  downloadingFileId: number | null;
  files: EquipmentFile[];
  isUploading: boolean;
  mode: "edit" | "view";
  onDelete: (file: EquipmentFile) => void;
  onDownload: (file: EquipmentFile) => void;
  onFileChange: (documentType: StorageDocumentType, file: File | null) => void;
  onOpenPreview: (file: EquipmentFile) => void;
  onSetPrimary?: (file: EquipmentFile) => void;
  selectedFile: File | null;
  settingPrimaryFileId?: number | null;
  title: string;
};

export function EquipmentDocumentTypeSection({
  deletingFileId,
  documentType,
  downloadingFileId,
  files,
  isUploading,
  mode,
  onDelete,
  onDownload,
  onFileChange,
  onOpenPreview,
  onSetPrimary,
  selectedFile,
  settingPrimaryFileId,
  title,
}: EquipmentDocumentTypeSectionProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedFile]);

  if (mode === "view" && files.length === 0) {
    return null;
  }

  return (
    <section className="equipment-document-type-section">
      <div className="equipment-document-type-header">
        <h2>{title}</h2>
      </div>

      {files.length > 0 ? (
        <ul className="equipment-documents-list">
          {files.map((file) => (
            <EquipmentDocumentListItem
              deletingFileId={deletingFileId}
              downloadingFileId={downloadingFileId}
              file={file}
              key={file.id}
              mode={mode}
              onDelete={onDelete}
              onDownload={onDownload}
              onOpenPreview={onOpenPreview}
              onSetPrimary={onSetPrimary}
              settingPrimaryFileId={settingPrimaryFileId}
            />
          ))}
        </ul>
      ) : null}

      {mode === "edit" ? (
        <EquipmentDocumentUploadForm
          documentType={documentType}
          fileInputId={fileInputId}
          fileInputRef={fileInputRef}
          isUploading={isUploading}
          onFileChange={(file) => onFileChange(documentType, file)}
          selectedFile={selectedFile}
        />
      ) : null}
    </section>
  );
}
