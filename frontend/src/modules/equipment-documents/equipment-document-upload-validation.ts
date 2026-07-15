import { ApiRequestError } from "../../shared/api/api-error";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-files/equipment-files.types";
import { equipmentDocumentsText as text } from "./equipment-documents.text";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type ValidateEquipmentDocumentUploadParams = {
  documentType: StorageDocumentType | "";
  files: EquipmentFile[];
  isUploading: boolean;
  selectedFile: File | null;
};

export function validateEquipmentDocumentUpload({
  documentType,
  files,
  isUploading,
  selectedFile,
}: ValidateEquipmentDocumentUploadParams) {
  if (isUploading) {
    return text.errors.uploadInProgress;
  }

  if (!documentType) {
    return text.errors.documentTypeRequired;
  }

  if (!selectedFile) {
    return text.errors.fileRequired;
  }

  if (!selectedFile.name.trim()) {
    return text.errors.unreadableFile;
  }

  if (selectedFile.size <= 0) {
    return text.errors.emptyFile;
  }

  if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
    return text.errors.fileTooLarge;
  }

  if (
    documentType === "passport" &&
    files.some(
      (file) => file.documentType === "passport" && file.deletedAt === null,
    )
  ) {
    return text.errors.passportAlreadyExists;
  }

  if (documentType === "passport" && !isPdfFile(selectedFile)) {
    return text.errors.passportPdfOnly;
  }

  if (documentType === "maintenance_instruction" && !isPdfFile(selectedFile)) {
    return text.errors.instructionPdfOnly;
  }

  if (documentType === "equipment_photo" && !isSupportedImageFile(selectedFile)) {
    return text.errors.photoImagesOnly;
  }

  return null;
}

export function getEquipmentDocumentUploadSuccessMessage(
  documentType: StorageDocumentType,
) {
  const messages: Record<StorageDocumentType, string> = {
    equipment_photo: text.success.photo,
    maintenance_instruction: text.success.instruction,
    passport: text.success.passport,
    supporting_document: text.success.supportingDocument,
  };

  return messages[documentType];
}

export function getEquipmentDocumentUploadErrorMessage(error: unknown) {
  if (isAbortError(error)) {
    return text.errors.timeout;
  }

  if (error instanceof TypeError) {
    return text.errors.network;
  }

  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return text.errors.sessionExpired;
    }

    if (error.status === 403) {
      return text.errors.forbidden;
    }

    if (error.status >= 500 && !error.code) {
      return text.errors.serverUnavailable;
    }

    return error.code ? getMessageByBackendCode(error.code, error.message) : error.message;
  }

  return text.errors.uploadFailed;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function getMessageByBackendCode(code: string, fallback: string) {
  const messages: Record<string, string> = {
    DATABASE_ERROR: text.errors.database,
    DOCUMENT_ALREADY_EXISTS: text.errors.passportAlreadyExists,
    DOCUMENT_TYPE_REQUIRED: text.errors.documentTypeRequired,
    EMPTY_FILE: text.errors.emptyFile,
    EQUIPMENT_NOT_FOUND: text.errors.equipmentNotFound,
    FILE_REQUIRED: text.errors.fileRequired,
    FILE_TOO_LARGE: text.errors.fileTooLarge,
    FORBIDDEN: text.errors.forbidden,
    INVALID_IMAGE: text.errors.invalidImage,
    INVALID_PDF: text.errors.invalidPdf,
    SESSION_EXPIRED: text.errors.sessionExpired,
    STORAGE_UNAVAILABLE: text.errors.storageUnavailable,
    UNSUPPORTED_DOCUMENT_TYPE: text.errors.unsupportedDocumentType,
    UNSUPPORTED_FILE_FORMAT: text.errors.unsupportedFileFormat,
    UPLOAD_FAILED: text.errors.uploadFailed,
  };

  return messages[code] ?? fallback;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || getFileExtension(file.name) === "pdf";
}

function isSupportedImageFile(file: File) {
  const extension = getFileExtension(file.name);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  return allowedMimeTypes.has(file.type) || allowedExtensions.has(extension);
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}
