import { useEffect, useState } from "react";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { AdminModal } from "../../shared/ui/AdminModal";

type UserPhotoFormModalProps = {
  isSaving: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (file: File) => void;
  user: AdminUserAccount;
};

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

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const validationError = validatePhotoFile(selectedFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!file) {
      setError("Выберите фото для загрузки.");
      return;
    }

    onSubmit(file);
  };

  return (
    <AdminModal onClose={onClose} title="Фото пользователя">
      <form className="admin-form user-photo-form" onSubmit={handleSubmit}>
        <div className="user-photo-preview">
          {previewUrl || user.photo?.mediumUrl ? (
            <img
              alt=""
              src={previewUrl ?? user.photo?.mediumUrl}
            />
          ) : (
            <span>{getInitials(user.employee?.fullName ?? user.username ?? user.email)}</span>
          )}
        </div>

        <label className="form-field">
          <span>Фото</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={isSaving}
            onChange={handleFileChange}
            type="file"
          />
        </label>

        <p className="admin-form-hint">
          Лучше загружать квадратное фото 1024×1024 или больше. Backend сам
          повернёт фото по EXIF и удалит метаданные.
        </p>

        {error ? <p className="admin-form-error">{error}</p> : null}

        <div className="admin-form-actions">
          {user.photo ? (
            <button
              className="admin-secondary-button user-photo-delete-button"
              disabled={isSaving}
              onClick={onDelete}
              type="button"
            >
              Удалить фото
            </button>
          ) : null}
          <button
            className="admin-secondary-button"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
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
