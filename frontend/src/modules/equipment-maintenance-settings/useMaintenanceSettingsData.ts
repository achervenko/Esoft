import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistAdminErrorMessage,
  getChecklistTemplates,
  type ChecklistTemplateListItem,
} from "../../shared/api/checklists";
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

type ReloadDataOptions = {
  silentError?: boolean;
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
  const [checklistTemplates, setChecklistTemplates] = useState<
    ChecklistTemplateListItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailableTypesLoading, setIsAvailableTypesLoading] =
    useState(false);
  const [isChecklistTemplatesLoading, setIsChecklistTemplatesLoading] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTypesError, setAvailableTypesError] = useState<string | null>(
    null,
  );
  const [checklistTemplatesError, setChecklistTemplatesError] = useState<
    string | null
  >(null);
  const availableTypesRequestIdRef = useRef(0);
  const checklistTemplatesRequestIdRef = useRef(0);
  const settingsRequestIdRef = useRef(0);
  const visibleIdRef = useRef(visibleId);

  visibleIdRef.current = visibleId;

  const isCurrentVisibleId = useCallback(
    (requestVisibleId: number) => visibleIdRef.current === requestVisibleId,
    [],
  );

  const reloadMaintenanceSettings = useCallback(async (
    options?: ReloadDataOptions,
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
      options?: ReloadDataOptions,
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

  const reloadChecklistTemplates = useCallback(
    async (
      options?: ReloadDataOptions,
    ): Promise<{ items: ChecklistTemplateListItem[] } | null> => {
      const requestId = checklistTemplatesRequestIdRef.current + 1;
      const requestVisibleId = visibleId;
      checklistTemplatesRequestIdRef.current = requestId;
      const shouldApply = () =>
        isCurrentVisibleId(requestVisibleId) &&
        checklistTemplatesRequestIdRef.current === requestId &&
        options?.shouldApply?.() !== false;

      setIsChecklistTemplatesLoading(true);
      setChecklistTemplatesError(null);

      try {
        const templatesResponse = await getChecklistTemplates({
          limit: 500,
          state: "ACTIVE",
        });

        if (!shouldApply()) {
          return null;
        }

        setChecklistTemplates(templatesResponse.items);
        return templatesResponse;
      } catch (requestError) {
        if (shouldApply() && !options?.silentError) {
          setChecklistTemplatesError(
            getChecklistAdminErrorMessage(requestError),
          );
        }

        return null;
      } finally {
        if (shouldApply()) {
          setIsChecklistTemplatesLoading(false);
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
    setChecklistTemplates([]);
    setError(null);
    setAvailableTypesError(null);
    setChecklistTemplatesError(null);
    setIsLoading(true);
    setIsAvailableTypesLoading(false);
    setIsChecklistTemplatesLoading(false);

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
      void reloadChecklistTemplates({
        shouldApply: () => isMounted,
      });
    }

    return () => {
      isMounted = false;
      availableTypesRequestIdRef.current += 1;
      checklistTemplatesRequestIdRef.current += 1;
      settingsRequestIdRef.current += 1;
    };
  }, [
    canManage,
    reloadAvailableMaintenanceTypes,
    reloadChecklistTemplates,
    reloadMaintenanceSettings,
  ]);

  return {
    availableMaintenanceTypes,
    availableTypesError,
    checklistTemplates,
    checklistTemplatesError,
    error,
    applySettingsResponse,
    clearDataError,
    isAvailableTypesLoading,
    isChecklistTemplatesLoading,
    isLoading,
    reloadAvailableMaintenanceTypes,
    reloadChecklistTemplates,
    reloadMaintenanceSettings,
    settingsResponse,
  };
}
