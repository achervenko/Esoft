import { Plus, Trash2 } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "../../shared/ui/ContextMenu";
import type { TemplateStructureMenuState } from "./template-structure.types";
export function TemplateStructureContextMenu({
  menu,
  onAddQuestions,
  onDelete,
  onClose,
}: {
  menu: TemplateStructureMenuState;
  onAddQuestions: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!menu) return null;
  const items: ContextMenuItem[] = [];
  if (menu.target.kind === "module")
    items.push({
      id: "add",
      label: "Добавить вопросы",
      icon: <Plus size={16} />,
      onSelect: onAddQuestions,
    });
  items.push({
    id: "delete",
    label: menu.target.kind === "module" ? "Удалить модуль" : "Удалить вопрос",
    icon: <Trash2 size={16} />,
    danger: true,
    onSelect: onDelete,
  });
  return (
    <ContextMenu
      x={menu.x}
      y={menu.y}
      label="Действия со структурой"
      items={items}
      onClose={onClose}
    />
  );
}
