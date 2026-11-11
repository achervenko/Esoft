import { useEffect, useId, useState } from "react";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { FileDropzone } from "../../shared/ui/FileDropzone";
import "../../shared/ui/FormField.css";

type UserPhotoFormModalProps = {
  isSaving: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (file: File) => void;
  user: AdminUserAccount;
};

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function UserPhotoFormModal({
  isSaving,
  onClose,
  onDelete,
  onSubmit,
  user,
}: UserPhotoFormModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const errorId = useId();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleFilesChange = ([selectedFile]: File[]) => {
    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const validationError = validatePhotoFile(selectedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || checking) {
      return;
    }

    if (!file) {
      setError("Выберите фото для загрузки.");
      return;
    }

    onSubmit(file);
  };

  return (
    <GuardedAdminModal
      hasChanges={file !== null}
      isCloseDisabled={isSaving}
      onClose={onClose}
      title="Фото пользователя"
    >
      {(requestLeave) => (
        <form className="admin-form user-photo-form" onSubmit={handleSubmit}>
          <div className="user-photo-preview">
            {previewUrl || user.photo?.mediumUrl ? (
              <img alt="" src={previewUrl ?? user.photo?.mediumUrl} />
            ) : (
              <span>
                {getInitials(
                  user.employee?.fullName ?? user.username ?? user.email,
                )}
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="Фото"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="form-field"
          >
            <FileDropzone
              files={file ? [file] : []}
              onFilesChange={handleFilesChange}
              onCheckingChange={setChecking}
              accept={PHOTO_ACCEPT}
              imageAccept={PHOTO_ACCEPT}
              mobileGalleryOnly
              disabled={isSaving}
            />
            {error && (
              <small
                id={errorId}
                className="form-field-message field-error"
                data-visible="true"
                role="alert"
              >
                {error}
              </small>
            )}
          </div>

          <p className="admin-form-hint">
            Лучше загружать квадратное фото 1024×1024 или больше. Backend сам
            повернёт фото по EXIF и удалит метаданные.
          </p>

          <div className="admin-form-actions">
            {user.photo ? (
              <button
                className="admin-secondary-button user-photo-delete-button"
                disabled={isSaving}
                onClick={() => requestLeave(onDelete)}
                type="button"
              >
                Удалить фото
              </button>
            ) : null}
            <button
              className="admin-secondary-button"
              disabled={isSaving}
              onClick={() => requestLeave(onClose)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="admin-primary-button"
              disabled={isSaving || checking}
              type="submit"
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}
    </GuardedAdminModal>
  );
}

function validatePhotoFile(file: File) {
  if (file.size <= 0) {
    return "Файл пустой.";
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return "Размер фото не должен превышать 10 МБ.";
  }

  if (!SUPPORTED_TYPES.has(file.type)) {
    return "Для фото доступны только JPG, PNG и WebP.";
  }

  return null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
