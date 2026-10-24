import "./AdminButtons.css";
import { Edit2, Trash2 } from "lucide-react";

type AdminTableActionsProps = {
  disabled?: boolean;
  deleteLabel: string;
  editLabel: string;
  onDelete: () => void;
  onEdit: () => void;
};

export function AdminTableActions({
  disabled = false,
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
        disabled={disabled}
        onClick={onEdit}
        title="Редактировать"
        type="button"
      >
        <Edit2 size={17} />
      </button>
      <button
        aria-label={deleteLabel}
        className="admin-icon-button"
        disabled={disabled}
        onClick={onDelete}
        title="Удалить"
        type="button"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
