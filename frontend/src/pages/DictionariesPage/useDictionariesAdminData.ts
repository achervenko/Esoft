import { useCallback, useState } from "react";
import { getAdminEmployees, type AdminEmployee } from "../../shared/api/users-admin-api";
import {
  getDictionaryCountries,
  getDictionaryEquipmentModels,
  getDictionaryLocations,
  getDictionaryManufacturers,
  getDictionaryObjects,
  type DictionaryCountry,
  type DictionaryEquipmentModel,
  type DictionaryLocation,
  type DictionaryManufacturer,
  type DictionaryObject,
} from "../../shared/api/dictionaries-admin-api";
import { getDictionariesAdminErrorMessage } from "./dictionaries-admin-error-messages";

export function useDictionariesAdminData() {
  const [countries, setCountries] = useState<DictionaryCountry[]>([]);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [locations, setLocations] = useState<DictionaryLocation[]>([]);
  const [manufacturers, setManufacturers] = useState<DictionaryManufacturer[]>(
    [],
  );
  const [models, setModels] = useState<DictionaryEquipmentModel[]>([]);
  const [objects, setObjects] = useState<DictionaryObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([
      getAdminEmployees(),
      getDictionaryManufacturers(),
      getDictionaryEquipmentModels(),
      getDictionaryCountries(),
      getDictionaryObjects(),
      getDictionaryLocations(),
    ])
      .then(
        ([
          employeeItems,
          manufacturerItems,
          modelItems,
          countryItems,
          objectItems,
          locationItems,
        ]) => {
          setEmployees(employeeItems);
          setManufacturers(manufacturerItems);
          setModels(modelItems);
          setCountries(countryItems);
          setObjects(objectItems);
          setLocations(locationItems);
        },
      )
      .catch((requestError) =>
        setError(getDictionariesAdminErrorMessage(requestError)),
      )
      .finally(() => setIsLoading(false));
  }, []);

  return {
    countries,
    employees,
    error,
    isLoading,
    loadData,
    locations,
    manufacturers,
    models,
    objects,
    setError,
    setIsLoading,
  };
}
