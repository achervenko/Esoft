import { Upload } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import type { StorageDocumentType } from "../../shared/api/equipment-api";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import {
  documentTypeOptions,
  equipmentDocumentsText as text,
} from "./equipment-documents.text";
import "./EquipmentDocumentUploadForm.css";

type EquipmentDocumentUploadFormProps = {
  documentType: StorageDocumentType | "";
  fileInputId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  onDocumentTypeChange: (documentType: StorageDocumentType | "") => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedFile: File | null;
};

export function EquipmentDocumentUploadForm({
  documentType,
  fileInputId,
  fileInputRef,
  isUploading,
  onDocumentTypeChange,
  onFileChange,
  onSubmit,
  selectedFile,
}: EquipmentDocumentUploadFormProps) {
  return (
    <form className="equipment-document-upload" onSubmit={onSubmit}>
      <h2>{text.uploadTitle}</h2>

      <div className="equipment-document-upload-grid">
        <SelectDropdown
          label={text.type}
          onChange={(value) => onDocumentTypeChange(value as StorageDocumentType)}
          options={documentTypeOptions}
          placeholder={text.selectDocumentType}
          required
          value={documentType}
        />

        <label className="form-field">
          <span>
            {text.file}
            <b aria-hidden="true">*</b>
          </span>
          <div className="equipment-file-picker">
            <input
              ref={fileInputRef}
              accept={getFileInputAccept(documentType)}
              id={fileInputId}
              disabled={isUploading}
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

      <div className="equipment-document-upload-actions">
        <button
          className="equipment-submit-button"
          disabled={isUploading}
          type="submit"
        >
          <Upload aria-hidden="true" size={18} />
          <span>{isUploading ? text.uploading : text.upload}</span>
        </button>
      </div>
    </form>
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
