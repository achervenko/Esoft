import { Plus } from "lucide-react";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-files/equipment-files.types";
import { EquipmentDocumentListItem } from "./EquipmentDocumentListItem";

type EquipmentDocumentTypeSectionProps = {
  deletingFileId: number | null;
  documentType: StorageDocumentType;
  downloadingFileId: number | null;
  files: EquipmentFile[];
  mode: "edit" | "view";
  onDelete: (file: EquipmentFile) => void;
  onDownload: (file: EquipmentFile) => void;
  onAddFiles: (documentType: StorageDocumentType) => void;
  onOpenPreview: (file: EquipmentFile) => void;
  onSetPrimary?: (file: EquipmentFile) => void;
  settingPrimaryFileId?: number | null;
  title: string;
  visibleId: number;
};

export function EquipmentDocumentTypeSection({
  deletingFileId,
  documentType,
  downloadingFileId,
  files,
  mode,
  onDelete,
  onDownload,
  onAddFiles,
  onOpenPreview,
  onSetPrimary,
  settingPrimaryFileId,
  title,
  visibleId,
}: EquipmentDocumentTypeSectionProps) {
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
              visibleId={visibleId}
            />
          ))}
        </ul>
      ) : null}

      {mode === "edit" ? (
        <button
          type="button"
          className="admin-secondary-button equipment-document-add-button"
          onClick={() => onAddFiles(documentType)}
        >
          <Plus size={16} aria-hidden="true" />
          {documentType === "passport" ? "Добавить файл" : "Добавить файлы"}
        </button>
      ) : null}
    </section>
  );
}
