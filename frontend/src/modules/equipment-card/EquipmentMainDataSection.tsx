import type { EquipmentFile } from "../../shared/api/equipment-api";
import { EquipmentCardGrid } from "./EquipmentCardGrid";
import { EquipmentPhotoGallery } from "./EquipmentPhotoGallery";
import type { EquipmentCardField } from "./equipment-card-view-model";

type EquipmentMainDataSectionProps = {
  fields: EquipmentCardField[];
  photos: EquipmentFile[];
  title: string;
};

export function EquipmentMainDataSection({
  fields,
  photos,
  title,
}: EquipmentMainDataSectionProps) {
  return (
    <section className="equipment-card-view-section equipment-card-main-section">
      <h2>{title}</h2>
      <div className="equipment-card-main-layout">
        <EquipmentPhotoGallery photos={photos} />
        <EquipmentCardGrid items={fields} />
      </div>
    </section>
  );
}
