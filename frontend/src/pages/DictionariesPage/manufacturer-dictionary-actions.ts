import type { Dispatch, SetStateAction } from "react";
import {
  createDictionaryEquipmentModel,
  createDictionaryManufacturer,
  deleteDictionaryEquipmentModel,
  deleteDictionaryManufacturer,
  updateDictionaryEquipmentModel,
  updateDictionaryManufacturer,
  type DictionaryEquipmentModel,
  type DictionaryManufacturer,
  type DictionaryNamePayload,
  type EquipmentModelPayload,
} from "../../shared/api/dictionaries-admin-api";
import type {
  EquipmentModelFormState,
  ManufacturerFormState,
} from "./dictionaries-page-types";

type ManufacturerDictionaryActionsParams = {
  loadData: () => void;
  manufacturerForm: ManufacturerFormState;
  modelForm: EquipmentModelFormState;
  runSavingAction: (action: () => Promise<void>) => Promise<void>;
  setManufacturerForm: Dispatch<SetStateAction<ManufacturerFormState>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setModelForm: Dispatch<SetStateAction<EquipmentModelFormState>>;
};

export function createManufacturerDictionaryActions({
  loadData,
  manufacturerForm,
  modelForm,
  runSavingAction,
  setManufacturerForm,
  setMessage,
  setModelForm,
}: ManufacturerDictionaryActionsParams) {
  const saveManufacturer = async (payload: DictionaryNamePayload) => {
    await runSavingAction(async () => {
      if (manufacturerForm === "new") {
        await createDictionaryManufacturer(payload);
        setMessage("Производитель добавлен.");
      } else if (manufacturerForm) {
        await updateDictionaryManufacturer(manufacturerForm.id, payload);
        setMessage("Производитель обновлён.");
      }

      setManufacturerForm(null);
      loadData();
    });
  };

  const removeManufacturer = async (manufacturer: DictionaryManufacturer) => {
    if (!window.confirm(`Удалить производителя «${manufacturer.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryManufacturer(manufacturer.id);
      setMessage("Производитель удалён.");
      loadData();
    });
  };

  const saveModel = async (payload: EquipmentModelPayload) => {
    await runSavingAction(async () => {
      if (modelForm === "new") {
        await createDictionaryEquipmentModel(payload);
        setMessage("Модель добавлена.");
      } else if (modelForm) {
        await updateDictionaryEquipmentModel(modelForm.id, payload);
        setMessage("Модель обновлена.");
      }

      setModelForm(null);
      loadData();
    });
  };

  const removeModel = async (model: DictionaryEquipmentModel) => {
    if (!window.confirm(`Удалить модель «${model.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryEquipmentModel(model.id);
      setMessage("Модель удалена.");
      loadData();
    });
  };

  return {
    removeManufacturer,
    removeModel,
    saveManufacturer,
    saveModel,
  };
}
