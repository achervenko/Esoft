import type { EquipmentCardField } from "./equipment-card-view-model";

type EquipmentCardGridProps = {
  items: EquipmentCardField[];
};

export function EquipmentCardGrid({ items }: EquipmentCardGridProps) {
  return (
    <dl className="equipment-card-view-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
