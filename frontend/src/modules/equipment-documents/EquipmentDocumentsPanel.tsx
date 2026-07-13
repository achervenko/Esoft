import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { UnsavedChangesGuard } from "../../shared/ui/UnsavedChangesGuard";
import { EquipmentDocumentTypeSection } from "./EquipmentDocumentTypeSection";
import {
  getSelectedDocumentEntries,
  hasSelectedDocumentFiles,
  type SelectedEquipmentDocumentFiles,
} from "./equipment-document-selection";
import {
  getEquipmentDocumentUploadErrorMessage,
  validateEquipmentDocumentUpload,
} from "./equipment-document-upload-validation";
import { getDisplayName } from "./equipment-document-utils";
import {
  documentTypeOptions,
  equipmentDocumentsText as text,
} from "./equipment-documents.text";
import "./EquipmentDocumentsPanel.css";

type EquipmentDocumentsPanelProps = {
  mode: "edit" | "view";
  visibleId: number;
};

export function EquipmentDocumentsPanel({
  mode,
  visibleId,
}: EquipmentDocumentsPanelProps) {
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
  const [previewFile, setPreviewFile] = useState<EquipmentFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDocumentEntries = useMemo(
    () => getSelectedDocumentEntries(selectedFiles),
    [selectedFiles],
  );
  const hasUnsavedDocumentChanges = selectedDocumentEntries.length > 0;

  const filesByDocumentType = useMemo(() => {
    return documentTypeOptions.reduce(
      (groups, option) => ({
        ...groups,
        [option.value]: files.filter((file) => file.documentType === option.value),
      }),
      {} as Record<StorageDocumentType, EquipmentFile[]>,
    );
  }, [files]);

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

  const handleFileChange = (
    nextDocumentType: StorageDocumentType,
    file: File | null,
  ) => {
    setSelectedFiles((currentFiles) => ({
      ...currentFiles,
      [nextDocumentType]: file,
    }));
  };

  const handleSaveChanges = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError(null);
    setMessage(null);

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
        setError(validationError);
        return;
      }
    }

    const uploadedDocumentTypes: StorageDocumentType[] = [];

    try {
      for (const [documentType, selectedFile] of selectedDocumentEntries) {
        setUploadingDocumentType(documentType);

        await uploadEquipmentFile({
          documentType,
          file: selectedFile,
          visibleId,
        });

        uploadedDocumentTypes.push(documentType);
      }

      setSelectedFiles({});
      setMessage(text.savedChanges);
      loadFiles();
    } catch (requestError) {
      setError(getEquipmentDocumentUploadErrorMessage(requestError));
      setSelectedFiles((currentFiles) => {
        const nextFiles = { ...currentFiles };
        uploadedDocumentTypes.forEach((documentType) => {
          nextFiles[documentType] = null;
        });
        return nextFiles;
      });
    } finally {
      setUploadingDocumentType(null);
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
        <UnsavedChangesGuard hasChanges={hasUnsavedDocumentChanges} />
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {isLoading ? (
        <section className="equipment-documents-list-section">
          <p className="equipment-documents-muted">{text.loading}</p>
        </section>
      ) : null}

      {!isLoading && mode === "view" && files.length === 0 ? (
        <section className="equipment-documents-list-section">
          <div className="equipment-documents-empty">
            <p>{text.emptyView}</p>
          </div>
        </section>
      ) : null}

      {!isLoading
        ? documentTypeOptions.map((option) => (
            <EquipmentDocumentTypeSection
              deletingFileId={deletingFileId}
              documentType={option.value}
              downloadingFileId={downloadingFileId}
              files={filesByDocumentType[option.value]}
              isUploading={Boolean(uploadingDocumentType)}
              key={option.value}
              mode={mode}
              onDelete={handleDelete}
              onDownload={(file) => void handleDownload(file)}
              onFileChange={handleFileChange}
              onOpenPreview={setPreviewFile}
              selectedFile={selectedFiles[option.value] ?? null}
              title={option.label}
            />
          ))
        : null}

      {mode === "edit" && !isLoading && hasUnsavedDocumentChanges ? (
        <form
          className="equipment-form-actions"
          onSubmit={(event) => void handleSaveChanges(event)}
        >
          <button
            className="equipment-submit-button"
            disabled={Boolean(uploadingDocumentType)}
            type="submit"
          >
            <Save aria-hidden="true" size={18} />
            <span>{uploadingDocumentType ? text.saving : text.saveChanges}</span>
          </button>
        </form>
      ) : null}

      <PdfPreviewModal
        fileId={previewFile?.id ?? null}
        fileName={previewFile ? getDisplayName(previewFile) : ""}
        onClose={() => setPreviewFile(null)}
        open={Boolean(previewFile)}
      />
    </section>
  );
}
