type UserPhotoPreviewModalProps = {
  imageUrl: string;
  onClose: () => void;
};

export function UserPhotoPreviewModal({
  imageUrl,
  onClose,
}: UserPhotoPreviewModalProps) {
  return (
    <div
      className="user-photo-preview-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-label="Увеличенное фото пользователя"
        aria-modal="true"
        className="user-photo-preview-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Закрыть" onClick={onClose} type="button">
          ×
        </button>
        <img alt="" src={imageUrl} />
      </section>
    </div>
  );
}
