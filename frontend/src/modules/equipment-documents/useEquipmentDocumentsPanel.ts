import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getEquipmentFiles } from "../../shared/api/equipment-files/equipment-files.api";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-files/equipment-files.types";
import { useNotifications } from "../../shared/ui/notifications";
import { groupEquipmentFilesByDocumentType } from "./equipment-document-files";
import {
  getSelectedDocumentEntries,
  type SelectedEquipmentDocumentFiles,
} from "./equipment-document-selection";
import { documentTypeOptions } from "./equipment-documents.text";
import { useEquipmentDocumentActions } from "./useEquipmentDocumentActions";

type UseEquipmentDocumentsPanelParams = {
  onSaved?: () => void;
  visibleId: number;
};

export function useEquipmentDocumentsPanel({
  onSaved,
  visibleId,
}: UseEquipmentDocumentsPanelParams) {
  const { notifyError, notifySuccess, notifyWarning } = useNotifications();
  const visibleIdRef = useRef(visibleId);
  const [files, setFiles] = useState<EquipmentFile[]>([]);
  const [selectedFiles, setSelectedFiles] =
    useState<SelectedEquipmentDocumentFiles>({});
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingDocumentType, setUploadingDocumentType] =
    useState<StorageDocumentType | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(
    null,
  );
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [settingPrimaryFileId, setSettingPrimaryFileId] = useState<
    number | null
  >(null);
  const [previewFile, setPreviewFile] = useState<EquipmentFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDocumentEntries = useMemo(
    () => getSelectedDocumentEntries(selectedFiles),
    [selectedFiles],
  );
  const hasUnsavedDocumentChanges = selectedDocumentEntries.length > 0;

  const filesByDocumentType = useMemo(
    () =>
      groupEquipmentFilesByDocumentType(
        files,
        documentTypeOptions.map((option) => option.value),
      ),
    [files],
  );

  useEffect(() => {
    visibleIdRef.current = visibleId;
  }, [visibleId]);

  const loadFiles = () => {
    const requestedVisibleId = visibleId;

    setIsLoading(true);
    setError(null);

    getEquipmentFiles(requestedVisibleId)
      .then((fileItems) => {
        if (visibleIdRef.current === requestedVisibleId) {
          setFiles(fileItems);
        }
      })
      .catch((requestError) => {
        if (visibleIdRef.current !== requestedVisibleId) {
          return;
        }

        const errorMessage = getApiErrorMessage(requestError);
        setError(errorMessage);
        notifyError("Не удалось загрузить документы оборудования", errorMessage);
      })
      .finally(() => {
        if (visibleIdRef.current === requestedVisibleId) {
          setIsLoading(false);
        }
      });
  };

  useEffect(() => {
    let isMounted = true;

    setFiles([]);
    setSelectedFiles({});
    setPreviewFile(null);
    setUploadingDocumentType(null);
    setDownloadingFileId(null);
    setDeletingFileId(null);
    setSettingPrimaryFileId(null);
    setIsLoading(true);
    setError(null);

    getEquipmentFiles(visibleId)
      .then((fileItems) => {
        if (isMounted) {
          setFiles(fileItems);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          const errorMessage = getApiErrorMessage(requestError);
          setError(errorMessage);
          notifyError("Не удалось загрузить документы оборудования", errorMessage);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [notifyError, visibleId]);

  const actions = useEquipmentDocumentActions({
    files,
    loadFiles,
    notifyError,
    notifySuccess,
    notifyWarning,
    onFilesChange: setFiles,
    onSaved,
    onSelectedFilesChange: setSelectedFiles,
    onErrorChange: setError,
    onUploadingDocumentTypeChange: setUploadingDocumentType,
    onDownloadingFileIdChange: setDownloadingFileId,
    onDeletingFileIdChange: setDeletingFileId,
    onSettingPrimaryFileIdChange: setSettingPrimaryFileId,
    selectedDocumentEntries,
    selectedFiles,
    uploadingDocumentType,
    visibleId,
  });

  return {
    deletingFileId,
    downloadingFileId,
    error,
    files,
    filesByDocumentType,
    hasUnsavedDocumentChanges,
    isLoading,
    previewFile,
    selectedFiles,
    settingPrimaryFileId,
    setPreviewFile,
    uploadingDocumentType,
    ...actions,
  };
}
