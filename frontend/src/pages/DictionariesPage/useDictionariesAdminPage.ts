import { dictionaryTabs, getAvailableDictionaryTabs } from "./dictionary-tabs";
import { setHashRoute } from "../../lib/hash-router";
import { hasPermission } from "../../shared/lib/permissions";
import { useConfirmation } from "../../shared/ui/useConfirmation";
import { useEffect, useState } from "react";
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
  userPermissions: readonly string[] | null;
};

function getRouteTab() {
  const [path, query] = window.location.hash.split("?");
  if (path !== "#/dictionaries") return undefined;
  const value = new URLSearchParams(query).get("tab");
  const id = value === "storage-locations" ? "storageLocations" : value;
  return dictionaryTabs.find((tab) => tab.id === id)?.id;
}

export function useDictionariesAdminPage({
  userPermissions,
}: UseDictionariesAdminPageParams) {
  const confirm = useConfirmation();
  const dictionariesManageable = hasPermission(
    userPermissions,
    "dictionaries.manage",
  );
  const [requestedTab, setRequestedTab] = useState<ActiveDictionariesTab>(
    () => {
      const routeTab = getRouteTab();
      if (routeTab) return routeTab;
      try {
        const saved = sessionStorage.getItem("esoft:dictionaries:tab");
        return (
          dictionaryTabs.find((tab) => tab.id === saved)?.id ?? "employees"
        );
      } catch {
        return "employees";
      }
    },
  );
  useEffect(() => {
    const onHashChange = () => {
      const tab = getRouteTab();
      if (tab) setRequestedTab(tab);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const setActiveTab = (tab: ActiveDictionariesTab) => {
    setRequestedTab(tab);
    const value = tab === "storageLocations" ? "storage-locations" : tab;
    setHashRoute(`#/dictionaries?tab=${value}`);
  };
  const availableTabs = getAvailableDictionaryTabs(userPermissions);
  const activeTab =
    availableTabs.find((tab) => tab.id === requestedTab)?.id ??
    availableTabs[0]?.id ??
    "employees";
  const hasAvailableTabs = availableTabs.length > 0;
  useEffect(() => {
    if (hasAvailableTabs && requestedTab !== activeTab) {
      setRequestedTab(activeTab);
    }
  }, [activeTab, requestedTab, hasAvailableTabs]);
  useEffect(() => {
    try {
      sessionStorage.setItem("esoft:dictionaries:tab", activeTab);
    } catch {
      // The page remains usable when browser storage is unavailable.
    }
  }, [activeTab]);
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
  const { notifyError, notifySuccess } = useNotifications();

  const data = useDictionariesAdminData(activeTab, dictionariesManageable);
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
    availableTabs,
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
    togglePositionStatus: async (position: AdminPosition) => {
      if (
        position.isActive &&
        !(await confirm({
          description: `Удалить должность «${position.name}»?`,
          confirmLabel: "Удалить",
          variant: "danger",
        }))
      )
        return;
      await runSavingAction(async () => {
        await setAdminPositionStatus(position.id, !position.isActive);
        await loadData(["positions", "employees"]);
        showSuccessMessage(
          position.isActive ? "Должность удалена." : "Должность включена.",
        );
      });
    },
    countries: data.countries,
    countryForm,
    employees: data.employees,
    employeeForm,
    error: data.error,
    retry: data.retry,
    dictionariesManageable,
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
