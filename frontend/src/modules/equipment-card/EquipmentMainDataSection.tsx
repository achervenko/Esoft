import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { EquipmentCardGrid } from "./EquipmentCardGrid";
import { EquipmentPhotoGallery } from "./EquipmentPhotoGallery";
import type { EquipmentCardField } from "./equipment-card-view-model";

type EquipmentMainDataSectionProps = {
  fields: EquipmentCardField[];
  isPhotosLoading?: boolean;
  photoError?: string | null;
  photos: EquipmentFile[];
  title: string;
};

export function EquipmentMainDataSection({
  fields,
  isPhotosLoading = false,
  photoError = null,
  photos,
  title,
}: EquipmentMainDataSectionProps) {
  return (
    <section className="equipment-card-view-section equipment-card-main-section">
      <h2>{title}</h2>
      <div className="equipment-card-main-layout">
        <EquipmentPhotoGallery
          error={photoError}
          isLoading={isPhotosLoading}
          photos={photos}
        />
        <EquipmentCardGrid items={fields} />
      </div>
    </section>
  );
}
