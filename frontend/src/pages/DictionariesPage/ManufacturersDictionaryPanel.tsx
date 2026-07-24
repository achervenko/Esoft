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
  onCreateModel: () => void;
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
  return (
    <div className="admin-nested-sections">
      <section className="admin-nested-section">
        <header>
          <h3>Производители</h3>
          <button
            className="admin-primary-button"
            onClick={onCreateManufacturer}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <ManufacturersTable
          manufacturers={manufacturers}
          onDelete={onDeleteManufacturer}
          onEdit={onEditManufacturer}
        />
      </section>

      <section className="admin-nested-section">
        <header>
          <h3>Модели</h3>
          <button
            className="admin-primary-button"
            disabled={manufacturers.length === 0}
            onClick={onCreateModel}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <EquipmentModelsTable
          models={models}
          onDelete={onDeleteModel}
          onEdit={onEditModel}
        />
      </section>
    </div>
  );
}
