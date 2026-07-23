import { useEffect, useState } from "react";
import { useNotifications } from "../../shared/ui/notifications";
import { createCountryDictionaryActions } from "./country-dictionary-actions";
import {
  type ActiveDictionariesTab,
  type CountryFormState,
  type EmployeeDictionaryFormState,
  type EquipmentModelFormState,
  type LocationFormState,
  type ManufacturerFormState,
  type ObjectFormState,
} from "./dictionaries-page-types";
import { createEmployeeDictionaryActions } from "./employee-dictionary-actions";
import { getDictionariesAdminErrorMessage } from "./dictionaries-admin-error-messages";
import { createLocationDictionaryActions } from "./location-dictionary-actions";
import { createManufacturerDictionaryActions } from "./manufacturer-dictionary-actions";
import { useDictionariesAdminData } from "./useDictionariesAdminData";
import { useDictionariesSaving } from "./useDictionariesSaving";

export type {
  ActiveDictionariesTab,
  CountryFormState,
  EmployeeDictionaryFormState,
  EquipmentModelFormState,
  LocationFormState,
  ManufacturerFormState,
  ObjectFormState,
} from "./dictionaries-page-types";

type UseDictionariesAdminPageParams = {
  userRole: string | null;
};

export function useDictionariesAdminPage({
  userRole,
}: UseDictionariesAdminPageParams) {
  const [activeTab, setActiveTab] =
    useState<ActiveDictionariesTab>("employees");
  const [countryForm, setCountryForm] = useState<CountryFormState>(null);
  const [employeeForm, setEmployeeForm] =
    useState<EmployeeDictionaryFormState>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState>(null);
  const [manufacturerForm, setManufacturerForm] =
    useState<ManufacturerFormState>(null);
  const [modelForm, setModelForm] = useState<EquipmentModelFormState>(null);
  const [objectForm, setObjectForm] = useState<ObjectFormState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = userRole === "admin";
  const { notifyError, notifySuccess } = useNotifications();

  const data = useDictionariesAdminData();
  const { loadData, setIsLoading } = data;
  const { isSaving, runSavingAction } = useDictionariesSaving({
    notifyError,
    setError: data.setError,
    setMessage,
  });

  useEffect(() => {
    if (isAdmin) {
      void loadData().catch((requestError) => {
        notifyError(
          "Не удалось загрузить справочники",
          getDictionariesAdminErrorMessage(requestError),
        );
      });
      return;
    }

    setIsLoading(false);
  }, [isAdmin, loadData, notifyError, setIsLoading]);

  const showSuccessMessage = (nextMessage: string | null) => {
    setMessage(nextMessage);

    if (nextMessage) {
      notifySuccess(nextMessage);
    }
  };

  const employeeActions = createEmployeeDictionaryActions({
    employeeForm,
    loadData,
    runSavingAction,
    setEmployeeForm,
    setMessage: showSuccessMessage,
  });

  const manufacturerActions = createManufacturerDictionaryActions({
    loadData,
    manufacturerForm,
    modelForm,
    runSavingAction,
    setManufacturerForm,
    setMessage: showSuccessMessage,
    setModelForm,
  });

  const countryActions = createCountryDictionaryActions({
    countryForm,
    loadData,
    runSavingAction,
    setCountryForm,
    setMessage: showSuccessMessage,
  });

  const locationActions = createLocationDictionaryActions({
    loadData,
    locationForm,
    objectForm,
    runSavingAction,
    setLocationForm,
    setMessage: showSuccessMessage,
    setObjectForm,
  });

  return {
    activeTab,
    countries: data.countries,
    countryForm,
    employees: data.employees,
    employeeForm,
    error: data.error,
    isAdmin,
    isLoading: data.isLoading,
    isSaving,
    locationForm,
    locations: data.locations,
    manufacturerForm,
    manufacturers: data.manufacturers,
    message,
    modelForm,
    models: data.models,
    objectForm,
    objects: data.objects,
    ...countryActions,
    ...employeeActions,
    ...locationActions,
    ...manufacturerActions,
    setActiveTab,
    setCountryForm,
    setEmployeeForm,
    setLocationForm,
    setManufacturerForm,
    setModelForm,
    setObjectForm,
  };
}
