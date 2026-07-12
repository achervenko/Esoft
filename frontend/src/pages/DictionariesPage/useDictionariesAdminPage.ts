import { useEffect, useState } from "react";
import {
  createAdminEmployee,
  deleteAdminEmployee,
  getAdminEmployees,
  updateAdminEmployee,
  type AdminEmployee,
  type EmployeePayload,
} from "../../shared/api/users-admin-api";
import {
  createDictionaryCountry,
  createDictionaryManufacturer,
  createDictionaryLocation,
  createDictionaryObject,
  deleteDictionaryCountry,
  deleteDictionaryManufacturer,
  deleteDictionaryLocation,
  deleteDictionaryObject,
  getDictionaryCountries,
  getDictionaryLocations,
  getDictionaryManufacturers,
  getDictionaryObjects,
  updateDictionaryCountry,
  updateDictionaryManufacturer,
  updateDictionaryLocation,
  updateDictionaryObject,
  type CountryPayload,
  type DictionaryCountry,
  type DictionaryLocation,
  type DictionaryManufacturer,
  type DictionaryNamePayload,
  type DictionaryObject,
  type LocationPayload,
} from "../../shared/api/dictionaries-admin-api";
import { getDictionariesAdminErrorMessage } from "./dictionaries-admin-error-messages";

export type ActiveDictionariesTab =
  "employees" | "manufacturers" | "countries" | "locations";
export type EmployeeDictionaryFormState = AdminEmployee | "new" | null;
export type ManufacturerFormState = DictionaryManufacturer | "new" | null;
export type CountryFormState = DictionaryCountry | "new" | null;
export type ObjectFormState = DictionaryObject | "new" | null;
export type LocationFormState = DictionaryLocation | "new" | null;

type UseDictionariesAdminPageParams = {
  userRole: string | null;
};

export function useDictionariesAdminPage({
  userRole,
}: UseDictionariesAdminPageParams) {
  const [activeTab, setActiveTab] =
    useState<ActiveDictionariesTab>("employees");
  const [countries, setCountries] = useState<DictionaryCountry[]>([]);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [locations, setLocations] = useState<DictionaryLocation[]>([]);
  const [manufacturers, setManufacturers] = useState<DictionaryManufacturer[]>(
    [],
  );
  const [objects, setObjects] = useState<DictionaryObject[]>([]);
  const [countryForm, setCountryForm] = useState<CountryFormState>(null);
  const [employeeForm, setEmployeeForm] =
    useState<EmployeeDictionaryFormState>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState>(null);
  const [manufacturerForm, setManufacturerForm] =
    useState<ManufacturerFormState>(null);
  const [objectForm, setObjectForm] = useState<ObjectFormState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = userRole === "admin";

  const loadData = () => {
    setIsLoading(true);
    setError(null);

    Promise.all([
      getAdminEmployees(),
      getDictionaryManufacturers(),
      getDictionaryCountries(),
      getDictionaryObjects(),
      getDictionaryLocations(),
    ])
      .then(
        ([
          employeeItems,
          manufacturerItems,
          countryItems,
          objectItems,
          locationItems,
        ]) => {
          setEmployees(employeeItems);
          setManufacturers(manufacturerItems);
          setCountries(countryItems);
          setObjects(objectItems);
          setLocations(locationItems);
        },
      )
      .catch((requestError) =>
        setError(getDictionariesAdminErrorMessage(requestError)),
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
      return;
    }

    setIsLoading(false);
  }, [isAdmin]);

  const saveEmployee = async (payload: EmployeePayload) => {
    await runSavingAction(async () => {
      if (employeeForm === "new") {
        await createAdminEmployee(payload);
        setMessage("Сотрудник добавлен.");
      } else if (employeeForm) {
        await updateAdminEmployee(employeeForm.id, payload);
        setMessage("Сотрудник обновлён.");
      }

      setEmployeeForm(null);
      loadData();
    });
  };

  const removeEmployee = async (employee: AdminEmployee) => {
    if (!window.confirm(`Удалить сотрудника «${employee.fullName}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteAdminEmployee(employee.id);
      setMessage("Сотрудник удалён.");
      loadData();
    });
  };

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

  const saveCountry = async (payload: CountryPayload) => {
    await runSavingAction(async () => {
      if (countryForm === "new") {
        await createDictionaryCountry(payload);
        setMessage("Страна добавлена.");
      } else if (countryForm) {
        await updateDictionaryCountry(countryForm.id, payload);
        setMessage("Страна обновлена.");
      }

      setCountryForm(null);
      loadData();
    });
  };

  const removeCountry = async (country: DictionaryCountry) => {
    if (!window.confirm(`Удалить страну «${country.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryCountry(country.id);
      setMessage("Страна удалена.");
      loadData();
    });
  };

  const saveObject = async (payload: DictionaryNamePayload) => {
    await runSavingAction(async () => {
      if (objectForm === "new") {
        await createDictionaryObject(payload);
        setMessage("Объект добавлен.");
      } else if (objectForm) {
        await updateDictionaryObject(objectForm.id, payload);
        setMessage("Объект обновлён.");
      }

      setObjectForm(null);
      loadData();
    });
  };

  const removeObject = async (object: DictionaryObject) => {
    if (!window.confirm(`Удалить объект «${object.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryObject(object.id);
      setMessage("Объект удалён.");
      loadData();
    });
  };

  const saveLocation = async (payload: LocationPayload) => {
    await runSavingAction(async () => {
      if (locationForm === "new") {
        await createDictionaryLocation(payload);
        setMessage("Местонахождение добавлено.");
      } else if (locationForm) {
        await updateDictionaryLocation(locationForm.id, payload);
        setMessage("Местонахождение обновлено.");
      }

      setLocationForm(null);
      loadData();
    });
  };

  const removeLocation = async (location: DictionaryLocation) => {
    if (!window.confirm(`Удалить местонахождение «${location.name}»?`)) {
      return;
    }

    await runSavingAction(async () => {
      await deleteDictionaryLocation(location.id);
      setMessage("Местонахождение удалено.");
      loadData();
    });
  };

  const runSavingAction = async (action: () => Promise<void>) => {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await action();
    } catch (requestError) {
      setError(getDictionariesAdminErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    activeTab,
    countries,
    countryForm,
    employees,
    employeeForm,
    error,
    isAdmin,
    isLoading,
    isSaving,
    locationForm,
    locations,
    manufacturerForm,
    manufacturers,
    message,
    objectForm,
    objects,
    removeCountry,
    removeEmployee,
    removeLocation,
    removeManufacturer,
    removeObject,
    saveCountry,
    saveEmployee,
    saveLocation,
    saveManufacturer,
    saveObject,
    setActiveTab,
    setCountryForm,
    setEmployeeForm,
    setLocationForm,
    setManufacturerForm,
    setObjectForm,
  };
}
