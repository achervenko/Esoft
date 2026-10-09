import type { RequestConfirmation } from "../../shared/ui/useConfirmation";
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
  confirm: RequestConfirmation;
  loadData: () => Promise<void>;
  locationForm: LocationFormState;
  objectForm: ObjectFormState;
  runSavingAction: (action: () => Promise<void>) => Promise<void>;
  setLocationForm: Dispatch<SetStateAction<LocationFormState>>;
  setMessage: (message: string | null) => void;
  setObjectForm: Dispatch<SetStateAction<ObjectFormState>>;
};

export function createLocationDictionaryActions({
  confirm,
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
    if (
      !(await confirm({
        description: `Удалить объект «${object.name}»?`,
        confirmLabel: "Удалить",
        variant: "danger",
      }))
    ) {
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
    if (
      !(await confirm({
        description: `Удалить местонахождение «${location.name}»?`,
        confirmLabel: "Удалить",
        variant: "danger",
      }))
    ) {
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
