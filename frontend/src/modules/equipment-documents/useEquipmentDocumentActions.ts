import { useConfirmation } from "../../shared/ui/useConfirmation";
import { getApiErrorMessage } from "../../shared/api/api-error";
import {
  deleteEquipmentFile,
  downloadEquipmentFile,
  setEquipmentFilePrimary,
} from "../../shared/api/equipment-files/equipment-files.api";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { getDisplayName } from "./equipment-document-utils";
import { equipmentDocumentsText as text } from "./equipment-documents.text";

type UseEquipmentDocumentActionsParams = {
  notifyError: (title: string, message?: string) => string;
  notifySuccess: (title: string, message?: string) => string;
  onFilesChange: (
    update:
      EquipmentFile[] | ((currentFiles: EquipmentFile[]) => EquipmentFile[]),
  ) => void;
  onErrorChange: (error: string | null) => void;
  onDownloadingFileIdChange: (fileId: number | null) => void;
  onDeletingFileIdChange: (fileId: number | null) => void;
  onSettingPrimaryFileIdChange: (fileId: number | null) => void;
  visibleId: number;
};

export function useEquipmentDocumentActions({
  notifyError,
  notifySuccess,
  onFilesChange,
  onErrorChange,
  onDownloadingFileIdChange,
  onDeletingFileIdChange,
  onSettingPrimaryFileIdChange,
  visibleId,
}: UseEquipmentDocumentActionsParams) {
  const confirm = useConfirmation();
  const handleDelete = async (file: EquipmentFile) => {
    const isConfirmed = await confirm({
      title: "Удалить документ?",
      description: `${text.deleteConfirmPrefix}${getDisplayName(file)}${text.deleteConfirmSuffix}`,
      variant: "danger",
    });

    if (!isConfirmed) {
      return;
    }

    onErrorChange(null);
    onDeletingFileIdChange(file.id);

    try {
      await deleteEquipmentFile({ fileId: file.id, visibleId });
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
      await downloadEquipmentFile({ file, visibleId });
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
      const updatedFile = await setEquipmentFilePrimary({
        fileId: file.id,
        visibleId,
      });

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
    handleSetPrimary,
  };
}
