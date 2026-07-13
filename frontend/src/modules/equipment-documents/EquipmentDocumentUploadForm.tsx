import type { RefObject } from "react";
import type { StorageDocumentType } from "../../shared/api/equipment-api";
import { equipmentDocumentsText as text } from "./equipment-documents.text";
import "./EquipmentDocumentUploadForm.css";

type EquipmentDocumentUploadFormProps = {
  documentType: StorageDocumentType;
  fileInputId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  onFileChange: (file: File | null) => void;
  selectedFile: File | null;
};

export function EquipmentDocumentUploadForm({
  documentType,
  fileInputId,
  fileInputRef,
  isUploading,
  onFileChange,
  selectedFile,
}: EquipmentDocumentUploadFormProps) {
  return (
    <div className="equipment-document-upload">
      <label className="form-field">
        <span>{text.file}</span>
        <div className="equipment-file-picker">
          <input
            ref={fileInputRef}
            accept={getFileInputAccept(documentType)}
            disabled={isUploading}
            id={fileInputId}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            type="file"
          />
          <label className="equipment-file-picker-button" htmlFor={fileInputId}>
            {text.chooseFile}
          </label>
          <span className="equipment-file-picker-name">
            {selectedFile?.name ?? text.fileNotSelected}
          </span>
        </div>
      </label>
    </div>
  );
}

function getFileInputAccept(documentType: StorageDocumentType | "") {
  if (
    documentType === "passport" ||
    documentType === "maintenance_instruction"
  ) {
    return "application/pdf,.pdf";
  }

  if (documentType === "equipment_photo") {
    return "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  }

  return undefined;
}
