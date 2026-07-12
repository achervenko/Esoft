import { Edit2, Trash2 } from "lucide-react";

type AdminTableActionsProps = {
  deleteLabel: string;
  editLabel: string;
  onDelete: () => void;
  onEdit: () => void;
};

export function AdminTableActions({
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
}: AdminTableActionsProps) {
  return (
    <div className="admin-table-actions">
      <button
        aria-label={editLabel}
        className="admin-icon-button"
        onClick={onEdit}
        title="Редактировать"
        type="button"
      >
        <Edit2 size={17} />
      </button>
      <button
        aria-label={deleteLabel}
        className="admin-icon-button"
        onClick={onDelete}
        title="Удалить"
        type="button"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
