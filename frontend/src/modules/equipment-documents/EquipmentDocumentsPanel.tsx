import { useEffect, useId, useRef, useState } from "react";
import {
  deleteEquipmentFile,
  downloadEquipmentFile,
  getEquipmentFiles,
  uploadEquipmentFile,
  type EquipmentFile,
  type StorageDocumentType,
} from "../../shared/api/equipment-api";
import { Notice } from "../../shared/ui/Notice";
import { PdfPreviewModal } from "../../shared/ui/PdfPreviewModal";
import { EquipmentDocumentsList } from "./EquipmentDocumentsList";
import { EquipmentDocumentUploadForm } from "./EquipmentDocumentUploadForm";
import {
  getEquipmentDocumentUploadErrorMessage,
  getEquipmentDocumentUploadSuccessMessage,
  validateEquipmentDocumentUpload,
} from "./equipment-document-upload-validation";
import { getDisplayName } from "./equipment-document-utils";
import { equipmentDocumentsText as text } from "./equipment-documents.text";
import "./EquipmentDocumentsPanel.css";

type EquipmentDocumentsPanelProps = {
  mode: "edit" | "view";
  visibleId: number;
};

export function EquipmentDocumentsPanel({
  mode,
  visibleId,
}: EquipmentDocumentsPanelProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<EquipmentFile[]>([]);
  const [documentType, setDocumentType] = useState<StorageDocumentType | "">(
    "",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(
    null,
  );
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<EquipmentFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadFiles = () => {
    setIsLoading(true);
    setError(null);

    getEquipmentFiles(visibleId)
      .then(setFiles)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    getEquipmentFiles(visibleId)
      .then((fileItems) => {
        if (isMounted) {
          setFiles(fileItems);
        }
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
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
  }, [visibleId]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateEquipmentDocumentUpload({
      documentType,
      files,
      isUploading,
      selectedFile,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!documentType || !selectedFile) {
      return;
    }

    setIsUploading(true);

    try {
      await uploadEquipmentFile({
        documentType,
        file: selectedFile,
        visibleId,
      });

      setMessage(getEquipmentDocumentUploadSuccessMessage(documentType));
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      loadFiles();
    } catch (requestError) {
      setError(getEquipmentDocumentUploadErrorMessage(requestError));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: EquipmentFile) => {
    const isConfirmed = window.confirm(
      `${text.deleteConfirmPrefix}${getDisplayName(file)}${text.deleteConfirmSuffix}`,
    );

    if (!isConfirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setDeletingFileId(file.id);

    try {
      await deleteEquipmentFile(file.id);
      setFiles((currentFiles) =>
        currentFiles.filter((currentFile) => currentFile.id !== file.id),
      );
      setMessage(text.deleted);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.",
      );
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDownload = async (file: EquipmentFile) => {
    setError(null);
    setDownloadingFileId(file.id);

    try {
      await downloadEquipmentFile(file);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u0430\u0447\u0430\u0442\u044c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.",
      );
    } finally {
      setDownloadingFileId(null);
    }
  };

  return (
    <section className="equipment-documents-panel">
      {mode === "edit" ? (
        <EquipmentDocumentUploadForm
          documentType={documentType}
          fileInputId={fileInputId}
          fileInputRef={fileInputRef}
          isUploading={isUploading}
          onDocumentTypeChange={setDocumentType}
          onFileChange={setSelectedFile}
          onSubmit={handleUpload}
          selectedFile={selectedFile}
        />
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <EquipmentDocumentsList
        deletingFileId={deletingFileId}
        downloadingFileId={downloadingFileId}
        files={files}
        isLoading={isLoading}
        mode={mode}
        onDelete={handleDelete}
        onDownload={(file) => void handleDownload(file)}
        onOpenPreview={setPreviewFile}
      />

      <PdfPreviewModal
        fileId={previewFile?.id ?? null}
        fileName={previewFile ? getDisplayName(previewFile) : ""}
        onClose={() => setPreviewFile(null)}
        open={Boolean(previewFile)}
      />
    </section>
  );
}
