import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAvailableMaintenanceTypes,
  getMaintenanceSettings,
} from "../../shared/api/maintenance/maintenance.api";
import type {
  AvailableMaintenanceTypesResponse,
  MaintenanceSettingsResponse,
  MaintenanceType,
} from "../../shared/api/maintenance/maintenance.types";
import { getMaintenanceSettingsErrorMessage } from "./maintenance-settings-errors";
import { reconcileAvailableMaintenanceTypes } from "./maintenance-settings-utils";

type ReloadAvailableTypesOptions = {
  silentError?: boolean;
  shouldApply?: () => boolean;
};

type ReloadSettingsOptions = {
  shouldApply?: () => boolean;
};

type UseMaintenanceSettingsDataOptions = {
  canManage: boolean;
  visibleId: number;
};

export function useMaintenanceSettingsData({
  canManage,
  visibleId,
}: UseMaintenanceSettingsDataOptions) {
  const [settingsResponse, setSettingsResponse] =
    useState<MaintenanceSettingsResponse | null>(null);
  const [availableMaintenanceTypes, setAvailableMaintenanceTypes] = useState<
    MaintenanceType[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailableTypesLoading, setIsAvailableTypesLoading] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTypesError, setAvailableTypesError] = useState<string | null>(
    null,
  );
  const availableTypesRequestIdRef = useRef(0);
  const settingsRequestIdRef = useRef(0);
  const visibleIdRef = useRef(visibleId);

  visibleIdRef.current = visibleId;

  const isCurrentVisibleId = useCallback(
    (requestVisibleId: number) => visibleIdRef.current === requestVisibleId,
    [],
  );

  const reloadMaintenanceSettings = useCallback(async (
    options?: ReloadSettingsOptions,
  ) => {
    const requestId = settingsRequestIdRef.current + 1;
    const requestVisibleId = visibleId;
    settingsRequestIdRef.current = requestId;
    const shouldApply = () =>
      isCurrentVisibleId(requestVisibleId) &&
      settingsRequestIdRef.current === requestId &&
      options?.shouldApply?.() !== false;

    const settingsData = await getMaintenanceSettings(requestVisibleId);

    if (!shouldApply()) {
      return null;
    }

    setSettingsResponse(settingsData);
    return settingsData;
  }, [isCurrentVisibleId, visibleId]);

  const reloadAvailableMaintenanceTypes = useCallback(
    async (
      options?: ReloadAvailableTypesOptions,
    ): Promise<AvailableMaintenanceTypesResponse | null> => {
      const requestId = availableTypesRequestIdRef.current + 1;
      const requestVisibleId = visibleId;
      availableTypesRequestIdRef.current = requestId;
      const shouldApply = () =>
        isCurrentVisibleId(requestVisibleId) &&
        availableTypesRequestIdRef.current === requestId &&
        options?.shouldApply?.() !== false;

      setIsAvailableTypesLoading(true);
      setAvailableTypesError(null);

      try {
        const availableTypesResponse =
          await getAvailableMaintenanceTypes(requestVisibleId);

        if (!shouldApply()) {
          return null;
        }

        setAvailableMaintenanceTypes(availableTypesResponse.maintenanceTypes);
        return availableTypesResponse;
      } catch (requestError) {
        if (shouldApply() && !options?.silentError) {
          setAvailableTypesError(
            getMaintenanceSettingsErrorMessage(requestError),
          );
        }

        return null;
      } finally {
        if (shouldApply()) {
          setIsAvailableTypesLoading(false);
        }
      }
    },
    [isCurrentVisibleId, visibleId],
  );

  const applySettingsResponse = useCallback(
    (
      nextSettingsResponse: MaintenanceSettingsResponse,
      previousSettingsResponse: MaintenanceSettingsResponse | null = null,
    ) => {
      setSettingsResponse(nextSettingsResponse);
      setAvailableMaintenanceTypes((currentAvailableTypes) =>
        reconcileAvailableMaintenanceTypes(
          currentAvailableTypes,
          nextSettingsResponse,
          previousSettingsResponse,
        ),
      );
      setAvailableTypesError(null);
    },
    [],
  );

  const clearDataError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setSettingsResponse(null);
    setAvailableMaintenanceTypes([]);
    setError(null);
    setAvailableTypesError(null);
    setIsLoading(true);
    setIsAvailableTypesLoading(false);

    const settingsRequest = reloadMaintenanceSettings({
      shouldApply: () => isMounted,
    });
    const settingsRequestId = settingsRequestIdRef.current;

    settingsRequest
      .catch((requestError) => {
        if (isMounted && settingsRequestIdRef.current === settingsRequestId) {
          setError(getMaintenanceSettingsErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isMounted && settingsRequestIdRef.current === settingsRequestId) {
          setIsLoading(false);
        }
      });

    if (canManage) {
      void reloadAvailableMaintenanceTypes({
        shouldApply: () => isMounted,
      });
    }

    return () => {
      isMounted = false;
      availableTypesRequestIdRef.current += 1;
      settingsRequestIdRef.current += 1;
    };
  }, [
    canManage,
    reloadAvailableMaintenanceTypes,
    reloadMaintenanceSettings,
    visibleId,
  ]);

  return {
    availableMaintenanceTypes,
    availableTypesError,
    error,
    applySettingsResponse,
    clearDataError,
    isAvailableTypesLoading,
    isLoading,
    reloadAvailableMaintenanceTypes,
    reloadMaintenanceSettings,
    settingsResponse,
  };
}
