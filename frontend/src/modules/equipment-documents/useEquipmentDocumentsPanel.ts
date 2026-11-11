import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getEquipmentFiles } from "../../shared/api/equipment-files/equipment-files.api";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { useNotifications } from "../../shared/ui/notifications";
import { groupEquipmentFilesByDocumentType } from "./equipment-document-files";
import { documentTypeOptions } from "./equipment-documents.text";
import { useEquipmentDocumentActions } from "./useEquipmentDocumentActions";

type UseEquipmentDocumentsPanelParams = {
  visibleId: number;
};

export function useEquipmentDocumentsPanel({
  visibleId,
}: UseEquipmentDocumentsPanelParams) {
  const { notifyError, notifySuccess } = useNotifications();
  const visibleIdRef = useRef(visibleId);
  const [files, setFiles] = useState<EquipmentFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(
    null,
  );
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [settingPrimaryFileId, setSettingPrimaryFileId] = useState<
    number | null
  >(null);
  const [previewFile, setPreviewFile] = useState<EquipmentFile | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    setFiles([]);
    setPreviewFile(null);
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
          notifyError(
            "Не удалось загрузить документы оборудования",
            errorMessage,
          );
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
    notifyError,
    notifySuccess,
    onFilesChange: setFiles,
    onErrorChange: setError,
    onDownloadingFileIdChange: setDownloadingFileId,
    onDeletingFileIdChange: setDeletingFileId,
    onSettingPrimaryFileIdChange: setSettingPrimaryFileId,
    visibleId,
  });

  return {
    deletingFileId,
    downloadingFileId,
    error,
    files,
    filesByDocumentType,
    isLoading,
    previewFile,
    settingPrimaryFileId,
    setPreviewFile,
    addUploadedFiles: (equipmentId: number, uploaded: EquipmentFile[]) => {
      if (visibleIdRef.current === equipmentId)
        setFiles((current) => [...current, ...uploaded]);
    },
    ...actions,
  };
}
