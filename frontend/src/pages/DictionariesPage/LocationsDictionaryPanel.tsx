import { useState } from "react";
import { NestedDictionarySections } from "../../shared/ui/NestedDictionarySections";
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
  const [parentId, setParentId] = useState<number | null>(null);
  const selectedParentId = objects.some((item) => item.id === parentId)
    ? parentId
    : null;
  const filtered =
    selectedParentId !== null
      ? locations.filter((item) => item.workshopId === selectedParentId)
      : locations;
  return (
    <NestedDictionarySections
      parentTitle="Объекты"
      childTitle="Местонахождения"
      onCreateParent={onCreateObject}
      onCreateChild={() => onCreateLocation(selectedParentId)}
      childCreateDisabled={objects.length === 0}
      parent={
        <ObjectsTable
          objects={objects}
          selectedId={selectedParentId}
          onSelect={(item) =>
            setParentId(item.id === selectedParentId ? null : item.id)
          }
          onDelete={onDeleteObject}
          onEdit={onEditObject}
        />
      }
    >
      <LocationsTable
        locations={filtered}
        onDelete={onDeleteLocation}
        onEdit={onEditLocation}
      />
    </NestedDictionarySections>
  );
}
