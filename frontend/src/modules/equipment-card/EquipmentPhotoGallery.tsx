import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EquipmentFile } from "../../shared/api/equipment-api";
import { getFilePreviewUrl } from "../../shared/api/files-api";
import { AsyncImage } from "../../shared/ui/AsyncImage";
import { ImagePreviewModal } from "../../shared/ui/ImagePreviewModal";
import { getDisplayName } from "../equipment-documents/equipment-document-utils";

type EquipmentPhotoGalleryProps = {
  photos: EquipmentFile[];
};

export function EquipmentPhotoGallery({ photos }: EquipmentPhotoGalleryProps) {
  const sortedPhotos = useMemo(
    () =>
      [...photos].sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1;
        }

        return right.id - left.id;
      }),
    [photos],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const activePhoto = sortedPhotos[activeIndex] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [sortedPhotos.length]);

  const canNavigate = sortedPhotos.length > 1;

  const showPrevious = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? sortedPhotos.length - 1 : currentIndex - 1,
    );
  };

  const showNext = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === sortedPhotos.length - 1 ? 0 : currentIndex + 1,
    );
  };

  return (
    <div className="equipment-photo-gallery">
      <div className="equipment-photo-frame">
        {activePhoto ? (
          <button
            aria-label="Открыть фото оборудования"
            className="equipment-photo-preview-button"
            onClick={() => setIsPreviewOpen(true)}
            type="button"
          >
            <AsyncImage
              alt={getDisplayName(activePhoto)}
              src={getFilePreviewUrl(activePhoto.id, { size: "medium" })}
            />
          </button>
        ) : (
          <div className="equipment-photo-placeholder">
            <ImageIcon aria-hidden="true" size={34} />
            <span>Фото не загружено</span>
          </div>
        )}
      </div>

      {canNavigate ? (
        <div className="equipment-photo-controls">
          <button
            aria-label="Предыдущее фото"
            onClick={showPrevious}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <span>
            {activeIndex + 1} / {sortedPhotos.length}
          </span>
          <button aria-label="Следующее фото" onClick={showNext} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      ) : null}

      {isPreviewOpen && activePhoto ? (
        <ImagePreviewModal
          ariaLabel="Увеличенное фото оборудования"
          counterLabel={
            canNavigate
              ? `${activeIndex + 1} / ${sortedPhotos.length}`
              : undefined
          }
          imageAlt={getDisplayName(activePhoto)}
          imageUrl={getFilePreviewUrl(activePhoto.id)}
          onClose={() => setIsPreviewOpen(false)}
          onNext={canNavigate ? showNext : undefined}
          onPrevious={canNavigate ? showPrevious : undefined}
        />
      ) : null}
    </div>
  );
}
