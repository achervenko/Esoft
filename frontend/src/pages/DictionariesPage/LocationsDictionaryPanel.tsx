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
  onCreateLocation: () => void;
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
  return (
    <div className="admin-nested-sections">
      <section className="admin-nested-section">
        <header>
          <h3>Объекты</h3>
          <button
            className="admin-primary-button"
            onClick={onCreateObject}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <ObjectsTable
          objects={objects}
          onDelete={onDeleteObject}
          onEdit={onEditObject}
        />
      </section>

      <section className="admin-nested-section">
        <header>
          <h3>Местонахождения</h3>
          <button
            className="admin-primary-button"
            disabled={objects.length === 0}
            onClick={onCreateLocation}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>
        <LocationsTable
          locations={locations}
          onDelete={onDeleteLocation}
          onEdit={onEditLocation}
        />
      </section>
    </div>
  );
}
