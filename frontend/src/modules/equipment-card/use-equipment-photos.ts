import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getEquipmentFiles } from "../../shared/api/equipment-files/equipment-files.api";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { useNotifications } from "../../shared/ui/notifications";

type UseEquipmentPhotosParams = {
  enabled: boolean;
  visibleId: number;
};

export function useEquipmentPhotos({
  enabled,
  visibleId,
}: UseEquipmentPhotosParams) {
  const { notifyError } = useNotifications();
  const [files, setFiles] = useState<EquipmentFile[]>([]);
  const [filesVisibleId, setFilesVisibleId] = useState<number | null>(null);
  const filesVisibleIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!enabled) {
      setIsLoading(false);

      return () => {
        isMounted = false;
      };
    }

    setIsLoading(filesVisibleIdRef.current !== visibleId);
    setError(null);

    getEquipmentFiles(visibleId)
      .then((fileItems) => {
        if (!isMounted) {
          return;
        }

        setFiles(fileItems);
        filesVisibleIdRef.current = visibleId;
        setFilesVisibleId(visibleId);
        setError(null);
      })
      .catch((requestError) => {
        if (!isMounted) {
          return;
        }

        if (filesVisibleIdRef.current !== visibleId) {
          setFiles([]);
          setFilesVisibleId(visibleId);
        }

        const errorMessage = getApiErrorMessage(requestError);
        setError(errorMessage);
        notifyError("Не удалось загрузить фото оборудования", errorMessage);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, notifyError, visibleId]);

  const photos = useMemo(
    () =>
      filesVisibleId === visibleId
        ? files.filter((file) => file.documentType === "equipment_photo")
        : [],
    [files, filesVisibleId, visibleId],
  );

  return {
    error,
    isLoading,
    photos,
  };
}
