import { useConfirmation } from "../../shared/ui/useConfirmation";
import { useState } from "react";
import {
  saveAdminPosition,
  setAdminPositionStatus,
  type AdminPosition,
} from "../../shared/api/users-admin-api";
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
  type PositionFormState,
} from "./dictionaries-page-types";
import { createEmployeeDictionaryActions } from "./employee-dictionary-actions";
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
  PositionFormState,
} from "./dictionaries-page-types";

type UseDictionariesAdminPageParams = {
  userRole: string | null;
};

export function useDictionariesAdminPage({
  userRole,
}: UseDictionariesAdminPageParams) {
  const confirm = useConfirmation();
  const [activeTab, setActiveTab] =
    useState<ActiveDictionariesTab>("employees");
  const [positionForm, setPositionForm] = useState<PositionFormState>(null);
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

  const data = useDictionariesAdminData(activeTab, isAdmin);
  const { loadData } = data;
  const { isSaving, runSavingAction } = useDictionariesSaving({
    notifyError,
    setError: data.setError,
    setMessage,
  });

  const showSuccessMessage = (nextMessage: string | null) => {
    setMessage(nextMessage);

    if (nextMessage) {
      notifySuccess(nextMessage);
    }
  };

  const employeeActions = createEmployeeDictionaryActions({
    confirm,
    employeeForm,
    loadData: () => loadData(["employees"]),
    runSavingAction,
    setEmployeeForm,
    setMessage: showSuccessMessage,
  });

  const manufacturerActions = createManufacturerDictionaryActions({
    confirm,
    loadData: () => loadData(["manufacturers", "models"]),
    manufacturerForm,
    modelForm,
    runSavingAction,
    setManufacturerForm,
    setMessage: showSuccessMessage,
    setModelForm,
  });

  const countryActions = createCountryDictionaryActions({
    confirm,
    countryForm,
    loadData: () => loadData(["countries"]),
    runSavingAction,
    setCountryForm,
    setMessage: showSuccessMessage,
  });

  const locationActions = createLocationDictionaryActions({
    confirm,
    loadData: () => loadData(["objects", "locations"]),
    locationForm,
    objectForm,
    runSavingAction,
    setLocationForm,
    setMessage: showSuccessMessage,
    setObjectForm,
  });

  return {
    activeTab,
    positions: data.positions,
    positionForm,
    setPositionForm,
    savePosition: (payload: { name: string }) =>
      runSavingAction(async () => {
        if (!positionForm) return;
        await saveAdminPosition(
          positionForm === "new" ? null : positionForm.id,
          payload,
        );
        setPositionForm(null);
        await loadData(["positions", "employees"]);
        showSuccessMessage("Должность сохранена.");
      }),
    togglePositionStatus: (position: AdminPosition) =>
      runSavingAction(async () => {
        await setAdminPositionStatus(position.id, !position.isActive);
        await loadData(["positions", "employees"]);
        showSuccessMessage(
          position.isActive ? "Должность отключена." : "Должность включена.",
        );
      }),
    countries: data.countries,
    countryForm,
    employees: data.employees,
    employeeForm,
    error: data.error,
    retry: data.retry,
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
