import { formatNullableText } from "../../shared/lib/formatters";
import type { EquipmentCardTextBlock } from "./equipment-card-view-model";

export function EquipmentTextBlock({ label, value }: EquipmentCardTextBlock) {
  return (
    <div className="equipment-card-view-text">
      <h3>{label}</h3>
      <p>{formatNullableText(value)}</p>
    </div>
  );
}
