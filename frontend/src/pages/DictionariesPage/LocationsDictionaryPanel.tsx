import { useId, useState } from "react";
import { Plus } from "lucide-react";
import type {
  DictionaryLocation,
  DictionaryObject,
} from "../../shared/api/dictionaries-admin-api";
import { LocationsTable } from "./LocationsTable";
import { ObjectsTable } from "./ObjectsTable";

type LocationsDictionaryPanelProps = {
  locations: DictionaryLocation[];
  objects: DictionaryObject[];
  onCreateLocation: (parentId: number | null) => void;
  onCreateObject: () => void;
  onDeleteLocation: (location: DictionaryLocation) => void;
  onDeleteObject: (object: DictionaryObject) => void;
  onEditLocation: (location: DictionaryLocation) => void;
  onEditObject: (object: DictionaryObject) => void;
};

export function LocationsDictionaryPanel({
  locations,
  objects,
  onCreateLocation,
  onCreateObject,
  onDeleteLocation,
  onDeleteObject,
  onEditLocation,
  onEditObject,
}: LocationsDictionaryPanelProps) {
  const parentHeadingId = useId();
  const childHeadingId = useId();
  const [parentId, setParentId] = useState<number | null>(null);
  const selectedParentId = objects.some((item) => item.id === parentId) ? parentId : null;
  const filtered = selectedParentId !== null
    ? locations.filter((item) => item.workshopId === selectedParentId)
    : locations;
  return (
    <div className="admin-nested-sections">
      <section className="admin-nested-section" aria-labelledby={parentHeadingId}>
        <header>
          <h3 id={parentHeadingId}>Объекты</h3>
          <button
            className="admin-primary-button"
            onClick={onCreateObject}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <div className="dictionary-table-surface dictionary-parent-surface">
          <ObjectsTable
            objects={objects}
            selectedId={selectedParentId}
            onSelect={(item) => setParentId(item.id === selectedParentId ? null : item.id)}
            onDelete={onDeleteObject}
            onEdit={onEditObject}
          />
        </div>
      </section>

      <section className="admin-nested-section" aria-labelledby={childHeadingId}>
        <header>
          <h3 id={childHeadingId}>Местонахождения</h3>
          <button
            className="admin-primary-button"
            disabled={objects.length === 0}
            onClick={() => onCreateLocation(selectedParentId)}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <div className="dictionary-table-surface">
          <LocationsTable
            locations={filtered}
            onDelete={onDeleteLocation}
            onEdit={onEditLocation}
          />
        </div>
      </section>
    </div>
  );
}
