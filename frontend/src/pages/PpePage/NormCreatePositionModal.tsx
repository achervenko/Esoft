import { useState } from "react";
import { Search } from "lucide-react";
import type { PpePosition } from "../../shared/api/ppe";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SearchSelect } from "../../shared/ui/SearchSelect";

export function NormCreatePositionModal({
  positions,
  onSelect,
  onClose,
}: {
  positions: PpePosition[];
  onSelect: (position: PpePosition) => void;
  onClose: () => void;
}) {
  const [positionId, setPositionId] = useState<number | null>(null);
  const selected = positions.find(
    (position) => position.id === positionId && position.isActive,
  );
  return (
    <AdminModal title="Добавить норму" onClose={onClose}>
      <form
        className="ppe-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected) onSelect(selected);
        }}
      >
        <SearchSelect
          label="Должность"
          placement="bottom"
          icon={<Search size={18} aria-hidden="true" />}
          emptyMessage="Должности не найдены"
          required
          autoFocus
          value={positionId}
          options={positions.filter((position) => position.isActive)}
          onChange={setPositionId}
        />
        <div className="ppe-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={onClose}
          >
            Отмена
          </button>
          <button className="admin-primary-button" disabled={!selected}>
            Продолжить
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
