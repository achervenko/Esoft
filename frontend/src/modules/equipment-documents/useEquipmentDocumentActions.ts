import type { FormEvent } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import {
  deleteEquipmentFile,
  downloadEquipmentFile,
  setEquipmentFilePrimary,
  uploadEquipmentFile,
} from "../../shared/api/equipment-files/equipment-files.api";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-files/equipment-files.types";
import {
  getSelectedDocumentEntries,
  hasSelectedDocumentFiles,
  type SelectedEquipmentDocumentFiles,
} from "./equipment-document-selection";
import {
  getEquipmentDocumentUploadErrorMessage,
  validateEquipmentDocumentUpload,
} from "./equipment-document-upload-validation";
import { notifyUploadValidationWarning } from "./equipment-document-notifications";
import { getDisplayName } from "./equipment-document-utils";
import { equipmentDocumentsText as text } from "./equipment-documents.text";

type UseEquipmentDocumentActionsParams = {
  files: EquipmentFile[];
  loadFiles: () => void;
  notifyError: (title: string, message?: string) => string;
  notifySuccess: (title: string, message?: string) => string;
  notifyWarning: (title: string, message?: string) => string;
  onFilesChange: (
    update: EquipmentFile[] | ((currentFiles: EquipmentFile[]) => EquipmentFile[]),
  ) => void;
  onSaved?: () => void;
  onSelectedFilesChange: (
    update:
      | SelectedEquipmentDocumentFiles
      | ((currentFiles: SelectedEquipmentDocumentFiles) => SelectedEquipmentDocumentFiles),
  ) => void;
  onErrorChange: (error: string | null) => void;
  onUploadingDocumentTypeChange: (documentType: StorageDocumentType | null) => void;
  onDownloadingFileIdChange: (fileId: number | null) => void;
  onDeletingFileIdChange: (fileId: number | null) => void;
  onSettingPrimaryFileIdChange: (fileId: number | null) => void;
  selectedDocumentEntries: ReturnType<typeof getSelectedDocumentEntries>;
  selectedFiles: SelectedEquipmentDocumentFiles;
  uploadingDocumentType: StorageDocumentType | null;
  visibleId: number;
};

export function useEquipmentDocumentActions({
  files,
  loadFiles,
  notifyError,
  notifySuccess,
  notifyWarning,
  onFilesChange,
  onSaved,
  onSelectedFilesChange,
  onErrorChange,
  onUploadingDocumentTypeChange,
  onDownloadingFileIdChange,
  onDeletingFileIdChange,
  onSettingPrimaryFileIdChange,
  selectedDocumentEntries,
  selectedFiles,
  uploadingDocumentType,
  visibleId,
}: UseEquipmentDocumentActionsParams) {
  const handleFileChange = (
    nextDocumentType: StorageDocumentType,
    file: File | null,
  ) => {
    onSelectedFilesChange((currentFiles) => ({
      ...currentFiles,
      [nextDocumentType]: file,
    }));
  };

  const handleSaveChanges = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    onErrorChange(null);

    if (uploadingDocumentType) {
      return;
    }

    if (!hasSelectedDocumentFiles(selectedFiles)) {
      return;
    }

    for (const [documentType, selectedFile] of selectedDocumentEntries) {
      const validationError = validateEquipmentDocumentUpload({
        documentType,
        files,
        isUploading: Boolean(uploadingDocumentType),
        selectedFile,
      });

      if (validationError) {
        onErrorChange(validationError);
        notifyUploadValidationWarning(validationError, notifyWarning);
        return;
      }
    }

    const uploadedDocumentTypes: StorageDocumentType[] = [];

    try {
      for (const [documentType, selectedFile] of selectedDocumentEntries) {
        onUploadingDocumentTypeChange(documentType);

        await uploadEquipmentFile({
          documentType,
          file: selectedFile,
          visibleId,
        });

        uploadedDocumentTypes.push(documentType);
      }

      onSelectedFilesChange({});
      notifySuccess(
        selectedDocumentEntries.length > 1 ? "Файлы загружены" : "Файл загружен",
      );
      loadFiles();
      onSaved?.();
    } catch (requestError) {
      const errorMessage = getEquipmentDocumentUploadErrorMessage(requestError);
      onErrorChange(errorMessage);
      notifyError("Не удалось загрузить файл", errorMessage);
      onSelectedFilesChange((currentFiles) => {
        const nextFiles = { ...currentFiles };
        uploadedDocumentTypes.forEach((documentType) => {
          nextFiles[documentType] = null;
        });
        return nextFiles;
      });

      if (uploadedDocumentTypes.length > 0) {
        loadFiles();
        onSaved?.();
      }
    } finally {
      onUploadingDocumentTypeChange(null);
    }
  };

  const handleDelete = async (file: EquipmentFile) => {
    const isConfirmed = window.confirm(
      `${text.deleteConfirmPrefix}${getDisplayName(file)}${text.deleteConfirmSuffix}`,
    );

    if (!isConfirmed) {
      return;
    }

    onErrorChange(null);
    onDeletingFileIdChange(file.id);

    try {
      await deleteEquipmentFile(file.id);
      onFilesChange((currentFiles) =>
        currentFiles.filter((currentFile) => currentFile.id !== file.id),
      );
    } catch (requestError) {
      const errorMessage = getApiErrorMessage(
        requestError,
        "Не удалось удалить документ.",
      );
      onErrorChange(errorMessage);
      notifyError("Не удалось удалить файл", errorMessage);
    } finally {
      onDeletingFileIdChange(null);
    }
  };

  const handleDownload = async (file: EquipmentFile) => {
    onErrorChange(null);
    onDownloadingFileIdChange(file.id);

    try {
      await downloadEquipmentFile(file);
    } catch (requestError) {
      const errorMessage = getApiErrorMessage(
        requestError,
        "Не удалось скачать документ.",
      );
      onErrorChange(errorMessage);
      notifyError("Не удалось скачать файл", errorMessage);
    } finally {
      onDownloadingFileIdChange(null);
    }
  };

  const handleSetPrimary = async (file: EquipmentFile) => {
    onErrorChange(null);
    onSettingPrimaryFileIdChange(file.id);

    try {
      const updatedFile = await setEquipmentFilePrimary(file.id);

      onFilesChange((currentFiles) =>
        currentFiles.map((currentFile) => {
          if (currentFile.documentType !== "equipment_photo") {
            return currentFile;
          }

          return {
            ...currentFile,
            isPrimary: currentFile.id === updatedFile.id,
          };
        }),
      );
      notifySuccess("Основное фото обновлено");
    } catch (requestError) {
      const errorMessage = getApiErrorMessage(
        requestError,
        "Не удалось назначить основное фото.",
      );
      onErrorChange(errorMessage);
      notifyError("Не удалось изменить данные файла", errorMessage);
    } finally {
      onSettingPrimaryFileIdChange(null);
    }
  };

  return {
    handleDelete,
    handleDownload,
    handleFileChange,
    handleSaveChanges,
    handleSetPrimary,
  };
}
