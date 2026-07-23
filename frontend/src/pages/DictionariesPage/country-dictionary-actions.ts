import type { Dispatch, SetStateAction } from "react";
import {
  createDictionaryCountry,
  deleteDictionaryCountry,
  updateDictionaryCountry,
  type CountryPayload,
  type DictionaryCountry,
} from "../../shared/api/dictionaries-admin-api";
import type { CountryFormState } from "./dictionaries-page-types";

type CountryDictionaryActionsParams = {
  countryForm: CountryFormState;
  loadData: () => Promise<void>;
  runSavingAction: (action: () => Promise<void>) => Promise<void>;
  setCountryForm: Dispatch<SetStateAction<CountryFormState>>;
  setMessage: (message: string | null) => void;
};

export function createCountryDictionaryActions({
  countryForm,
  loadData,
  runSavingAction,
  setCountryForm,
  setMessage,
}: CountryDictionaryActionsParams) {
  const saveCountry = async (payload: CountryPayload) => {
    await runSavingAction(async () => {
      if (countryForm === "new") {
        await createDictionaryCountry(payload);
        setMessage("Страна добавлена");
      } else if (countryForm) {
        await updateDictionaryCountry(countryForm.id, payload);
        setMessage("Страна обновлена");
      }

      setCountryForm(null);
      await loadData();
    });
  };

  const removeCountry = async (country: DictionaryCountry) => {
    if (!window.confirm(`Удалить страну «${country.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryCountry(country.id);
      setMessage("Страна удалена");
      await loadData();
    });
  };

  return {
    removeCountry,
    saveCountry,
  };
}
