import { Download, Star, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { EquipmentFile } from "../../shared/api/equipment-api";
import { EquipmentDocumentIcon } from "./EquipmentDocumentIcon";
import { getDisplayName, isPdfFile } from "./equipment-document-utils";
import { equipmentDocumentsText as text } from "./equipment-documents.text";
import "./EquipmentDocumentsList.css";

type EquipmentDocumentListItemProps = {
  deletingFileId: number | null;
  downloadingFileId: number | null;
  file: EquipmentFile;
  mode: "edit" | "view";
  onDelete: (file: EquipmentFile) => void;
  onDownload: (file: EquipmentFile) => void;
  onOpenPreview: (file: EquipmentFile) => void;
  onSetPrimary?: (file: EquipmentFile) => void;
  settingPrimaryFileId?: number | null;
};

export function EquipmentDocumentListItem({
  deletingFileId,
  downloadingFileId,
  file,
  mode,
  onDelete,
  onDownload,
  onOpenPreview,
  onSetPrimary,
  settingPrimaryFileId,
}: EquipmentDocumentListItemProps) {
  const isPreviewable = isPdfFile(file);
  const canSetPrimary =
    mode === "edit" &&
    file.documentType === "equipment_photo" &&
    !file.isPrimary &&
    Boolean(onSetPrimary);

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
        {canSetPrimary ? (
          <button
            className="equipment-document-action equipment-document-primary"
            disabled={settingPrimaryFileId === file.id}
            aria-label={
              settingPrimaryFileId === file.id
                ? text.makingPrimary
                : text.makePrimary
            }
            onClick={(event) => {
              event.stopPropagation();
              onSetPrimary?.(file);
            }}
            title={
              settingPrimaryFileId === file.id
                ? text.makingPrimary
                : text.makePrimary
            }
            type="button"
          >
            <Star aria-hidden="true" size={17} />
          </button>
        ) : null}

        <button
          className="equipment-document-action"
          disabled={downloadingFileId === file.id}
          aria-label={
            downloadingFileId === file.id ? text.downloading : text.download
          }
          onClick={(event) => {
            event.stopPropagation();
            onDownload(file);
          }}
          title={
            downloadingFileId === file.id ? text.downloading : text.download
          }
          type="button"
        >
          <Download aria-hidden="true" size={17} />
        </button>

        {mode === "edit" ? (
          <button
            className="equipment-document-action equipment-document-delete"
            disabled={deletingFileId === file.id}
            aria-label={
              deletingFileId === file.id ? text.deleting : text.delete
            }
            onClick={(event) => {
              event.stopPropagation();
              onDelete(file);
            }}
            title={deletingFileId === file.id ? text.deleting : text.delete}
            type="button"
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>
        ) : null}
      </div>
    </li>
  );
}
