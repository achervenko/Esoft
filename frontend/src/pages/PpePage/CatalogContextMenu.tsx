import { ContextMenu } from "../../shared/ui/ContextMenu";
export function CatalogContextMenu({
  x,
  y,
  active,
  onEdit,
  onToggle,
  onClose,
}: {
  x: number;
  y: number;
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <ContextMenu
      x={x}
      y={y}
      label="Действия с номенклатурой"
      onClose={onClose}
      items={[
        { id: "edit", label: "Изменить", onSelect: onEdit },
        {
          id: "toggle",
          label: active ? "Отключить" : "Включить",
          onSelect: onToggle,
        },
      ]}
    />
  );
}
