import { useRef, useState, type DragEvent } from "react";
import { Upload, X } from "lucide-react";
import "./AdminButtons.css";
import "./FileDropzone.css";

type FileDropzoneProps = {
  files: readonly File[];
  onFilesChange: (files: File[]) => void;
  onCheckingChange?: (checking: boolean) => void;
  accept?: string;
  imageAccept?: string;
  mobileGalleryOnly?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  getFileError?: (file: File) => string | null;
};

const fileIds = new WeakMap<File, number>();
let nextFileId = 0;

function getFileId(file: File) {
  const existing = fileIds.get(file);
  if (existing !== undefined) return existing;
  const id = ++nextFileId;
  fileIds.set(file, id);
  return id;
}

function sameMetadata(a: File, b: File) {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  );
}

function readBytes(file: Blob): Promise<ArrayBuffer> {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function sameContents(a: File, b: File) {
  if (a === b) return true;
  const chunkSize = 1024 * 1024;
  try {
    for (let start = 0; start < a.size; start += chunkSize) {
      const end = start + chunkSize;
      const [left, right] = await Promise.all([
        readBytes(a.slice(start, end)),
        readBytes(b.slice(start, end)),
      ]);
      const rightBytes = new Uint8Array(right);
      if (
        !new Uint8Array(left).every((byte, index) => byte === rightBytes[index])
      )
        return false;
    }
    return true;
  } catch {
    // Keep both files if their equality cannot be established.
    return false;
  }
}

export function FileDropzone({
  files,
  onFilesChange,
  onCheckingChange,
  accept,
  imageAccept,
  mobileGalleryOnly = false,
  multiple = false,
  disabled: disabledByForm = false,
  getFileError,
}: FileDropzoneProps) {
  const picker = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const disabled = disabledByForm || checking;

  async function addFiles(incoming: File[]) {
    if (disabled || checkingRef.current || !incoming.length) return;
    if (!multiple && incoming.length > 1) {
      setError("Выберите один файл.");
      return;
    }
    setError(null);
    const selection = [...files];
    try {
      for (const file of incoming) {
        let duplicate: File | undefined;
        for (const candidate of selection) {
          if (!sameMetadata(candidate, file)) continue;
          if (!checkingRef.current) {
            checkingRef.current = true;
            setChecking(true);
            onCheckingChange?.(true);
          }
          if (await sameContents(candidate, file)) {
            duplicate = candidate;
            break;
          }
        }
        if (!multiple) {
          onFilesChange([duplicate ?? file]);
          return;
        }
        if (!duplicate) selection.push(file);
      }
      onFilesChange(selection);
    } finally {
      if (checkingRef.current) {
        checkingRef.current = false;
        setChecking(false);
        onCheckingChange?.(false);
      }
    }
  }

  function handleDrag(event: DragEvent<HTMLElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    if (!disabled) setDragging(true);
  }

  return (
    <div className="file-dropzone">
      <div
        role="group"
        aria-label="Область загрузки файлов"
        className="file-dropzone-area"
        data-dragging={dragging && !disabled}
        onDragOver={handleDrag}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          )
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload size={24} aria-hidden="true" />
        <span className="file-dropzone-hint">
          {multiple ? "Перетащите файлы сюда" : "Перетащите файл сюда"}
        </span>
        <div
          className="file-dropzone-actions"
          data-mobile-gallery-only={mobileGalleryOnly && !!imageAccept}
        >
          <button
            type="button"
            className="admin-secondary-button file-dropzone-picker"
            disabled={disabled}
            onClick={() => picker.current?.click()}
          >
            {multiple
              ? "Выбрать файлы"
              : files.length
                ? "Заменить файл"
                : "Выбрать файл"}
          </button>
          {imageAccept && (
            <button
              type="button"
              className="admin-secondary-button file-dropzone-gallery"
              disabled={disabled}
              onClick={() => gallery.current?.click()}
            >
              Выбрать из галереи
            </button>
          )}
        </div>
        <input
          ref={picker}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            void addFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        {imageAccept && (
          <input
            ref={gallery}
            type="file"
            hidden
            accept={imageAccept}
            multiple={multiple}
            disabled={disabled}
            onChange={(event) => {
              void addFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        )}
      </div>
      {checking && <span role="status">Проверяем совпадения файлов…</span>}
      {error && (
        <p className="file-dropzone-error" role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="file-dropzone-list" aria-label="Выбранные файлы">
          {files.map((file, index) => {
            const fileError = getFileError?.(file);
            return (
              <li key={getFileId(file)}>
                <div className="file-dropzone-file">
                  <span>{file.name}</span>
                  {fileError && (
                    <span className="file-dropzone-error" role="alert">
                      {fileError}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="admin-secondary-button admin-icon-button"
                  aria-label={`Убрать ${file.name}`}
                  disabled={disabled}
                  onClick={() =>
                    onFilesChange(files.filter((_, i) => i !== index))
                  }
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
