import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { TemplateStructureMenuState } from "./template-structure.types";

type TemplateStructureContextMenuProps = {
  menu: TemplateStructureMenuState;
  onAddQuestions: () => void;
  onDelete: () => void;
};

export function TemplateStructureContextMenu({
  menu,
  onAddQuestions,
  onDelete,
}: TemplateStructureContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [menu]);

  if (!menu) {
    return null;
  }

  const deleteLabel =
    menu.target.kind === "module" ? "Удалить модуль" : "Удалить вопрос";

  return (
    <div
      className="checklist-structure-context-menu"
      onKeyDown={handleMenuKeyDown}
      ref={menuRef}
      role="menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.target.kind === "module" ? (
        <button onClick={onAddQuestions} role="menuitem" type="button">
          <Plus size={16} />
          Добавить вопросы
        </button>
      ) : null}
      <button
        className="danger"
        onClick={onDelete}
        role="menuitem"
        type="button"
      >
        <Trash2 size={16} />
        {deleteLabel}
      </button>
    </div>
  );
}

function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.key !== "ArrowDown" &&
    event.key !== "ArrowUp" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }

  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  );

  if (items.length === 0) {
    return;
  }

  event.preventDefault();
  const activeIndex = items.findIndex((item) => item === document.activeElement);

  if (event.key === "Home") {
    items[0]?.focus();
    return;
  }

  if (event.key === "End") {
    items.at(-1)?.focus();
    return;
  }

  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex =
    activeIndex === -1
      ? 0
      : (activeIndex + direction + items.length) % items.length;

  items[nextIndex]?.focus();
}
