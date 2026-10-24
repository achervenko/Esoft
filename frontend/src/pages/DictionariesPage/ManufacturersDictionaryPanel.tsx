import { useId, useState } from "react";
import { Plus } from "lucide-react";
import type {
  DictionaryEquipmentModel,
  DictionaryManufacturer,
} from "../../shared/api/dictionaries-admin-api";
import { EquipmentModelsTable } from "./EquipmentModelsTable";
import { ManufacturersTable } from "./ManufacturersTable";

type ManufacturersDictionaryPanelProps = {
  manufacturers: DictionaryManufacturer[];
  models: DictionaryEquipmentModel[];
  onCreateManufacturer: () => void;
  onCreateModel: (parentId: number | null) => void;
  onDeleteManufacturer: (manufacturer: DictionaryManufacturer) => void;
  onDeleteModel: (model: DictionaryEquipmentModel) => void;
  onEditManufacturer: (manufacturer: DictionaryManufacturer) => void;
  onEditModel: (model: DictionaryEquipmentModel) => void;
};

export function ManufacturersDictionaryPanel({
  manufacturers,
  models,
  onCreateManufacturer,
  onCreateModel,
  onDeleteManufacturer,
  onDeleteModel,
  onEditManufacturer,
  onEditModel,
}: ManufacturersDictionaryPanelProps) {
  const parentHeadingId = useId();
  const childHeadingId = useId();
  const [parentId, setParentId] = useState<number | null>(null);
  const selectedParentId = manufacturers.some((item) => item.id === parentId) ? parentId : null;
  const filtered = selectedParentId !== null
    ? models.filter((item) => item.manufacturerId === selectedParentId)
    : models;
  return (
    <div className="admin-nested-sections">
      <section className="admin-nested-section" aria-labelledby={parentHeadingId}>
        <header>
          <h3 id={parentHeadingId}>Производители</h3>
          <button
            className="admin-primary-button"
            onClick={onCreateManufacturer}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <div className="dictionary-table-surface dictionary-parent-surface">
          <ManufacturersTable
            manufacturers={manufacturers}
            selectedId={selectedParentId}
            onSelect={(item) => setParentId(item.id === selectedParentId ? null : item.id)}
            onDelete={onDeleteManufacturer}
            onEdit={onEditManufacturer}
          />
        </div>
      </section>

      <section className="admin-nested-section" aria-labelledby={childHeadingId}>
        <header>
          <h3 id={childHeadingId}>Модели</h3>
          <button
            className="admin-primary-button"
            disabled={manufacturers.length === 0}
            onClick={() => onCreateModel(selectedParentId)}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <div className="dictionary-table-surface dictionary-models-surface">
          <EquipmentModelsTable
            models={filtered}
            onDelete={onDeleteModel}
            onEdit={onEditModel}
          />
        </div>
      </section>
    </div>
  );
}
