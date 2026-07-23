import type { Dispatch, SetStateAction } from "react";
import {
  createDictionaryLocation,
  createDictionaryObject,
  deleteDictionaryLocation,
  deleteDictionaryObject,
  updateDictionaryLocation,
  updateDictionaryObject,
  type DictionaryLocation,
  type DictionaryNamePayload,
  type DictionaryObject,
  type LocationPayload,
} from "../../shared/api/dictionaries-admin-api";
import type {
  LocationFormState,
  ObjectFormState,
} from "./dictionaries-page-types";

type LocationDictionaryActionsParams = {
  loadData: () => Promise<void>;
  locationForm: LocationFormState;
  objectForm: ObjectFormState;
  runSavingAction: (action: () => Promise<void>) => Promise<void>;
  setLocationForm: Dispatch<SetStateAction<LocationFormState>>;
  setMessage: (message: string | null) => void;
  setObjectForm: Dispatch<SetStateAction<ObjectFormState>>;
};

export function createLocationDictionaryActions({
  loadData,
  locationForm,
  objectForm,
  runSavingAction,
  setLocationForm,
  setMessage,
  setObjectForm,
}: LocationDictionaryActionsParams) {
  const saveObject = async (payload: DictionaryNamePayload) => {
    await runSavingAction(async () => {
      if (objectForm === "new") {
        await createDictionaryObject(payload);
        setMessage("Объект добавлен");
      } else if (objectForm) {
        await updateDictionaryObject(objectForm.id, payload);
        setMessage("Объект обновлён");
      }

      setObjectForm(null);
      await loadData();
    });
  };

  const removeObject = async (object: DictionaryObject) => {
    if (!window.confirm(`Удалить объект «${object.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryObject(object.id);
      setMessage("Объект удалён");
      await loadData();
    });
  };

  const saveLocation = async (payload: LocationPayload) => {
    await runSavingAction(async () => {
      if (locationForm === "new") {
        await createDictionaryLocation(payload);
        setMessage("Местонахождение добавлено");
      } else if (locationForm) {
        await updateDictionaryLocation(locationForm.id, payload);
        setMessage("Местонахождение обновлено");
      }

      setLocationForm(null);
      await loadData();
    });
  };

  const removeLocation = async (location: DictionaryLocation) => {
    if (!window.confirm(`Удалить местонахождение «${location.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryLocation(location.id);
      setMessage("Местонахождение удалено");
      await loadData();
    });
  };

  return {
    removeLocation,
    removeObject,
    saveLocation,
    saveObject,
  };
}
