import { ImagePreviewModal } from "../../shared/ui/ImagePreviewModal";

type UserPhotoPreviewModalProps = {
  imageUrl: string;
  onClose: () => void;
};

export function UserPhotoPreviewModal({
  imageUrl,
  onClose,
}: UserPhotoPreviewModalProps) {
  return (
    <ImagePreviewModal
      ariaLabel="Увеличенное фото пользователя"
      imageUrl={imageUrl}
      onClose={onClose}
    />
  );
}
