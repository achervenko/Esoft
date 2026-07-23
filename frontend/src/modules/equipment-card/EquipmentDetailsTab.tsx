import type { EquipmentCard } from "../../shared/api/equipment/equipment.types";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { EquipmentCardGrid } from "./EquipmentCardGrid";
import { EquipmentMainDataSection } from "./EquipmentMainDataSection";
import { EquipmentTextBlock } from "./EquipmentTextBlock";
import {
  getEquipmentPanelId,
  getEquipmentTabId,
} from "./equipment-card-tab-ids";
import {
  getEquipmentCardSections,
  getEquipmentCardTextBlocks,
} from "./equipment-card-view-model";

type EquipmentDetailsTabProps = {
  equipment: EquipmentCard;
  isPhotosLoading: boolean;
  photos: EquipmentFile[];
  photosError: string | null;
};

export function EquipmentDetailsTab({
  equipment,
  isPhotosLoading,
  photos,
  photosError,
}: EquipmentDetailsTabProps) {
  const sections = getEquipmentCardSections(equipment);
  const [mainSection, ...secondarySections] = sections;
  const textBlocks = getEquipmentCardTextBlocks(equipment);

  return (
    <section
      aria-labelledby={getEquipmentTabId("details")}
      className="equipment-card-tab-panel"
      id={getEquipmentPanelId("details")}
      role="tabpanel"
    >
      {mainSection ? (
        <EquipmentMainDataSection
          fields={mainSection.fields}
          isPhotosLoading={isPhotosLoading}
          photoError={photosError}
          photos={photos}
          title={mainSection.title}
        />
      ) : null}

      {secondarySections.map((section) => (
        <section className="equipment-card-view-section" key={section.title}>
          <h2>{section.title}</h2>
          <EquipmentCardGrid items={section.fields} />
        </section>
      ))}

      <section className="equipment-card-view-section">
        <h2>Описание</h2>
        {textBlocks.map((block) => (
          <EquipmentTextBlock
            key={block.label}
            label={block.label}
            value={block.value}
          />
        ))}
      </section>
    </section>
  );
}
