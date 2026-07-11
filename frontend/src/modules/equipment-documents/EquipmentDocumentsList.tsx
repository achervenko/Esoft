import { Download, FileText, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { EquipmentFile } from "../../shared/api/equipment-api";
import { EquipmentDocumentIcon } from "./EquipmentDocumentIcon";
import {
  formatFileCount,
  getDisplayName,
  isPdfFile,
} from "./equipment-document-utils";
import { equipmentDocumentsText as text } from "./equipment-documents.text";
import "./EquipmentDocumentsList.css";

type EquipmentDocumentsListProps = {
  deletingFileId: number | null;
  downloadingFileId: number | null;
  files: EquipmentFile[];
  isLoading: boolean;
  mode: "edit" | "view";
  onDelete: (file: EquipmentFile) => void;
  onDownload: (file: EquipmentFile) => void;
  onOpenPreview: (file: EquipmentFile) => void;
};

export function EquipmentDocumentsList({
  deletingFileId,
  downloadingFileId,
  files,
  isLoading,
  mode,
  onDelete,
  onDownload,
  onOpenPreview,
}: EquipmentDocumentsListProps) {
  return (
    <section className="equipment-documents-list-section">
      <div className="equipment-documents-list-header">
        <div>
          <h2>{text.documentsTitle}</h2>
          <p>{files.length > 0 ? formatFileCount(files.length) : text.noFiles}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="equipment-documents-muted">{text.loading}</p>
      ) : null}

      {!isLoading && files.length === 0 ? (
        <div className="equipment-documents-empty">
          <FileText aria-hidden="true" size={28} />
          <p>{mode === "edit" ? text.emptyEdit : text.emptyView}</p>
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="equipment-documents-list">
          {files.map((file) => (
            <EquipmentDocumentsListItem
              deletingFileId={deletingFileId}
              downloadingFileId={downloadingFileId}
              file={file}
              key={file.id}
              mode={mode}
              onDelete={onDelete}
              onDownload={onDownload}
              onOpenPreview={onOpenPreview}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EquipmentDocumentsListItem({
  deletingFileId,
  downloadingFileId,
  file,
  mode,
  onDelete,
  onDownload,
  onOpenPreview,
}: Omit<EquipmentDocumentsListProps, "files" | "isLoading"> & {
  file: EquipmentFile;
}) {
  const isPreviewable = isPdfFile(file);

  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && isPreviewable) {
      event.preventDefault();
      onOpenPreview(file);
    }
  };

  return (
    <li
      className={isPreviewable ? "equipment-document-previewable" : undefined}
      onClick={() => {
        if (isPreviewable) {
          onOpenPreview(file);
        }
      }}
      onKeyDown={handleKeyDown}
      role={isPreviewable ? "button" : undefined}
      tabIndex={isPreviewable ? 0 : undefined}
    >
      <EquipmentDocumentIcon file={file} />

      <div className="equipment-document-meta">
        <strong>{getDisplayName(file)}</strong>
      </div>

      <div className="equipment-document-actions">
        <button
          className="equipment-document-action"
          disabled={downloadingFileId === file.id}
          onClick={(event) => {
            event.stopPropagation();
            onDownload(file);
          }}
          type="button"
        >
          <Download aria-hidden="true" size={17} />
          <span>
            {downloadingFileId === file.id ? text.downloading : text.download}
          </span>
        </button>

        {mode === "edit" ? (
          <button
            className="equipment-document-action equipment-document-delete"
            disabled={deletingFileId === file.id}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(file);
            }}
            type="button"
          >
            <Trash2 aria-hidden="true" size={17} />
            <span>{deletingFileId === file.id ? text.deleting : text.delete}</span>
          </button>
        ) : null}
      </div>
    </li>
  );
}
