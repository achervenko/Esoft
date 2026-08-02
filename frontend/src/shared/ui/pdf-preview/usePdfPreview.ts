import { useCallback, useEffect, useState } from "react";
import { fetchPdfPreviewBlob } from "../../api/files-api";
import { pdfPreviewText } from "./pdf-preview.text";

type UsePdfPreviewParams = {
  fileId: number | null;
  open: boolean;
  visibleId: number;
};

export function usePdfPreview({
  fileId,
  open,
  visibleId,
}: UsePdfPreviewParams) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadPreview = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!open || !fileId) {
      setFileUrl(null);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    let objectUrl: string | null = null;

    setError(null);
    setFileUrl(null);
    setIsLoading(true);

    fetchPdfPreviewBlob({ fileId, visibleId })
      .then((blob) => {
        if (abortController.signal.aborted) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      })
      .catch((requestError: Error) => {
        if (!abortController.signal.aborted) {
          setError(requestError.message || pdfPreviewText.error);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      abortController.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileId, open, reloadKey, visibleId]);

  return {
    error,
    fileUrl,
    isLoading,
    loadPreview,
    setError,
  };
}
