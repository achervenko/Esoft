import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistTemplates,
  type ChecklistTemplateListItem,
} from "../../shared/api/checklists";
import {
  getEquipmentEventResponsibleUsers,
} from "../../shared/api/equipment-events/equipment-events.api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getMaintenanceSettings } from "../../shared/api/maintenance/maintenance.api";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import type { ResponsibleUserOption } from "./equipment-event-form.types";

export function useEquipmentEventFormData(
  visibleId: number,
  enabled: boolean,
) {
  const [maintenanceSettings, setMaintenanceSettings] = useState<
    MaintenanceSetting[]
  >([]);
  const [checklistTemplates, setChecklistTemplates] = useState<
    ChecklistTemplateListItem[]
  >([]);
  const [responsibleUsers, setResponsibleUsers] = useState<
    ResponsibleUserOption[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestReloadIdRef = useRef(0);

  const reload = useCallback(
    async (options?: { shouldApply?: () => boolean }) => {
      const reloadId = latestReloadIdRef.current + 1;
      latestReloadIdRef.current = reloadId;

      setIsLoading(true);
      setError(null);

      try {
        const [
          settingsResponse,
          checklistTemplatesResponse,
          responsibleUsersResponse,
        ] = await Promise.all([
          enabled ? getMaintenanceSettings(visibleId) : Promise.resolve(null),
          getChecklistTemplates({ limit: 200, state: "ACTIVE" }),
          enabled
            ? getEquipmentEventResponsibleUsers()
            : Promise.resolve(null),
        ]);

        if (
          options?.shouldApply?.() !== false &&
          latestReloadIdRef.current === reloadId
        ) {
          setMaintenanceSettings(settingsResponse?.settings ?? []);
          setChecklistTemplates(checklistTemplatesResponse.items);
          setResponsibleUsers(
            (responsibleUsersResponse?.users ?? []).map((user) => ({
              id: user.userId,
              name: user.fullName,
              position: user.position,
            })),
          );
        }
      } catch (requestError) {
        if (
          options?.shouldApply?.() !== false &&
          latestReloadIdRef.current === reloadId
        ) {
          setError(getApiErrorMessage(requestError));
        }
      } finally {
        if (
          options?.shouldApply?.() !== false &&
          latestReloadIdRef.current === reloadId
        ) {
          setIsLoading(false);
        }
      }
    },
    [enabled, visibleId],
  );

  useEffect(() => {
    let isMounted = true;

    void reload({ shouldApply: () => isMounted });

    return () => {
      isMounted = false;
    };
  }, [enabled, reload]);

  return {
    error,
    checklistTemplates,
    isLoading,
    maintenanceSettings,
    reload,
    responsibleUsers,
  };
}
