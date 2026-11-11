import { useRef, useState } from "react";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-files/equipment-files.types";
import { uploadEquipmentFile } from "../../shared/api/equipment-files/equipment-files.api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { FileDropzone } from "../../shared/ui/FileDropzone";
import { createRequestKey } from "../../shared/lib/request-key";
import { UnsavedChangesGuard } from "../../shared/ui/UnsavedChangesGuard";
import { useNotifications } from "../../shared/ui/notifications";
import "../../shared/ui/AdminPage.css";
import {
  getEquipmentDocumentUploadErrorMessage,
  validateEquipmentDocumentUpload,
} from "./equipment-document-upload-validation";

const images = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const pdf = "application/pdf,.pdf";

type EquipmentDocumentUploadFormProps = {
  documentType: StorageDocumentType;
  existingFiles: EquipmentFile[];
  onClose: () => void;
  onUploaded: (files: EquipmentFile[], complete: boolean) => void;
  title: string;
  visibleId: number;
};

export function EquipmentDocumentUploadForm({
  documentType,
  existingFiles,
  onClose,
  onUploaded,
  title,
  visibleId,
}: EquipmentDocumentUploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [failures, setFailures] = useState(new Map<File, string>());
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const requestKeys = useRef(new WeakMap<File, string>());
  const { notifySuccess } = useNotifications();
  const validate = (file: File) =>
    validateEquipmentDocumentUpload({
      documentType,
      files: existingFiles,
      isUploading: false,
      selectedFile: file,
    });
  const ready = files.filter((file) => !validate(file));
  const isPhoto = documentType === "equipment_photo";
  const isSupportingDocument = documentType === "supporting_document";

  async function upload() {
    if (busy.current || checking || !ready.length) return;
    busy.current = true;
    setUploading(true);
    try {
      const uploaded: EquipmentFile[] = [];
      const succeeded = new Set<File>();
      const errors = new Map<File, string>();
      for (const file of ready) {
        try {
          const requestKey =
            requestKeys.current.get(file) ?? createRequestKey();
          requestKeys.current.set(file, requestKey);
          uploaded.push(
            await uploadEquipmentFile({
              documentType,
              file,
              visibleId,
              requestKey,
            }),
          );
          succeeded.add(file);
        } catch (error) {
          errors.set(file, getEquipmentDocumentUploadErrorMessage(error));
        }
      }
      const remaining = files.filter((file) => !succeeded.has(file));
      setFiles(remaining);
      setFailures(errors);
      if (uploaded.length) {
        notifySuccess(
          uploaded.length > 1 ? "Файлы загружены" : "Файл загружен",
        );
        if (!remaining.length) onClose();
        onUploaded(uploaded, !remaining.length);
      }
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }

  return (
    <UnsavedChangesGuard hasChanges={files.length > 0} isBlocked={uploading}>
      {(requestLeave) => (
        <AdminModal
          title={title}
          onClose={() => requestLeave(onClose)}
          isCloseDisabled={uploading}
        >
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void upload();
            }}
          >
            <FileDropzone
              files={files}
              onCheckingChange={setChecking}
              onFilesChange={(next) => {
                setFiles(next);
                setFailures(
                  (current) =>
                    new Map(
                      next.flatMap((file) => {
                        const error = current.get(file);
                        return error ? [[file, error] as const] : [];
                      }),
                    ),
                );
              }}
              accept={isPhoto ? images : isSupportingDocument ? undefined : pdf}
              mobileGalleryOnly={isPhoto}
              imageAccept={
                isPhoto || isSupportingDocument ? "image/*" : undefined
              }
              multiple={documentType !== "passport"}
              disabled={uploading}
              getFileError={(file) =>
                validate(file) ?? failures.get(file) ?? null
              }
            />
            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-secondary-button"
                disabled={uploading}
                onClick={() => requestLeave(onClose)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="admin-primary-button"
                disabled={uploading || checking || !ready.length}
              >
                {uploading
                  ? "Загрузка…"
                  : failures.size
                    ? "Повторить загрузку"
                    : "Загрузить"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </UnsavedChangesGuard>
  );
}
