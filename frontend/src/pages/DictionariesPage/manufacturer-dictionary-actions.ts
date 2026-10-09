import type { RequestConfirmation } from "../../shared/ui/useConfirmation";
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
  confirm: RequestConfirmation;
  loadData: () => Promise<void>;
  manufacturerForm: ManufacturerFormState;
  modelForm: EquipmentModelFormState;
  runSavingAction: (action: () => Promise<void>) => Promise<void>;
  setManufacturerForm: Dispatch<SetStateAction<ManufacturerFormState>>;
  setMessage: (message: string | null) => void;
  setModelForm: Dispatch<SetStateAction<EquipmentModelFormState>>;
};

export function createManufacturerDictionaryActions({
  confirm,
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
        setMessage("Производитель добавлен");
      } else if (manufacturerForm) {
        await updateDictionaryManufacturer(manufacturerForm.id, payload);
        setMessage("Производитель обновлён");
      }

      setManufacturerForm(null);
      await loadData();
    });
  };

  const removeManufacturer = async (manufacturer: DictionaryManufacturer) => {
    if (
      !(await confirm({
        description: `Удалить производителя «${manufacturer.name}»?`,
        variant: "danger",
      }))
    ) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryManufacturer(manufacturer.id);
      setMessage("Производитель удалён");
      await loadData();
    });
  };

  const saveModel = async (payload: EquipmentModelPayload) => {
    await runSavingAction(async () => {
      if (modelForm === "new") {
        await createDictionaryEquipmentModel(payload);
        setMessage("Модель добавлена");
      } else if (modelForm) {
        await updateDictionaryEquipmentModel(modelForm.id, payload);
        setMessage("Модель обновлена");
      }

      setModelForm(null);
      await loadData();
    });
  };

  const removeModel = async (model: DictionaryEquipmentModel) => {
    if (
      !(await confirm({
        description: `Удалить модель «${model.name}»?`,
        variant: "danger",
      }))
    ) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryEquipmentModel(model.id);
      setMessage("Модель удалена");
      await loadData();
    });
  };

  return {
    removeManufacturer,
    removeModel,
    saveManufacturer,
    saveModel,
  };
}
