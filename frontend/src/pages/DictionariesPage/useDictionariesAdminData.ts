import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAdminEmployees,
  getAdminPositions,
} from "../../shared/api/users-admin-api";
import {
  getDictionaryCountries,
  getDictionaryEquipmentModels,
  getDictionaryLocations,
  getDictionaryManufacturers,
  getDictionaryObjects,
} from "../../shared/api/dictionaries-admin-api";
import { getDictionariesAdminErrorMessage } from "./dictionaries-admin-error-messages";

import type { ActiveDictionariesTab } from "./dictionaries-page-types";

const loaders = {
  positions: () => getAdminPositions(),
  employees: () => getAdminEmployees(),
  manufacturers: () => getDictionaryManufacturers(),
  models: () => getDictionaryEquipmentModels(),
  countries: () => getDictionaryCountries(),
  objects: () => getDictionaryObjects(),
  locations: () => getDictionaryLocations(),
};
export type DictionaryResource = keyof typeof loaders;
type DictionaryData = {
  [K in DictionaryResource]: Awaited<ReturnType<(typeof loaders)[K]>>;
};
const tabResources: Record<ActiveDictionariesTab, DictionaryResource[]> = {
  employees: ["employees", "positions"],
  positions: ["positions"],
  manufacturers: ["manufacturers", "models"],
  countries: ["countries"],
  locations: ["objects", "locations"],
  storageLocations: [],
};
type ResourceState = {
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

export function useDictionariesAdminData(
  activeTab: ActiveDictionariesTab,
  enabled: boolean,
) {
  const [data, setData] = useState<DictionaryData>({
    countries: [],
    employees: [],
    positions: [],
    locations: [],
    manufacturers: [],
    models: [],
    objects: [],
  });
  const [states, setStates] = useState<
    Partial<Record<DictionaryResource, ResourceState>>
  >({});
  const [operationError, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
  }, [activeTab]);
  const requested = useRef<Partial<Record<DictionaryResource, boolean>>>({});
  const generations = useRef<Partial<Record<DictionaryResource, number>>>({});
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requested.current = {};
    };
  }, []);
  const loadData = useCallback(async (resources: DictionaryResource[]) => {
    await Promise.allSettled(
      resources.map(async (key) => {
        requested.current[key] = true;
        const generation = (generations.current[key] ?? 0) + 1;
        generations.current[key] = generation;
        const current = () =>
          mounted.current && generations.current[key] === generation;
        setStates((state) => ({
          ...state,
          [key]: {
            loading: true,
            error: null,
            loaded: state[key]?.loaded ?? false,
          },
        }));
        try {
          const result = await loaders[key]();
          if (!current()) return;
          setData((data) => ({ ...data, [key]: result }));
          setStates((state) => ({
            ...state,
            [key]: { loading: false, error: null, loaded: true },
          }));
        } catch (error) {
          if (!current()) return;
          setStates((state) => ({
            ...state,
            [key]: {
              loading: false,
              error: getDictionariesAdminErrorMessage(error),
              loaded: state[key]?.loaded ?? false,
            },
          }));
        }
      }),
    );
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const missing = tabResources[activeTab].filter(
      (key) => !requested.current[key],
    );
    if (missing.length) void loadData(missing);
  }, [activeTab, enabled, loadData]);
  const required = tabResources[activeTab];
  return {
    ...data,
    error:
      operationError ??
      required.map((key) => states[key]?.error).find(Boolean) ??
      null,
    isLoading:
      enabled && required.some((key) => !states[key] || states[key]?.loading),
    loadData,
    retry: () => {
      setError(null);
      void loadData(
        required.filter((key) => !states[key]?.loaded || states[key]?.error),
      );
    },
    setError,
  };
}
