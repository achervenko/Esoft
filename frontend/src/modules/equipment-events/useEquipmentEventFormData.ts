import { useCallback, useEffect, useState } from "react";
import {
  getEquipmentEventResponsibleUsers,
} from "../../shared/api/equipment-events/equipment-events.api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getMaintenanceSettings } from "../../shared/api/maintenance/maintenance.api";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import type { ResponsibleUserOption } from "./EquipmentEventFormModal";

export function useEquipmentEventFormData(
  visibleId: number,
  enabled: boolean,
) {
  const [maintenanceSettings, setMaintenanceSettings] = useState<
    MaintenanceSetting[]
  >([]);
  const [responsibleUsers, setResponsibleUsers] = useState<
    ResponsibleUserOption[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (options?: { shouldApply?: () => boolean }) => {
      setIsLoading(true);
      setError(null);

      try {
        const [settingsResponse, responsibleUsersResponse] =
          await Promise.all([
            getMaintenanceSettings(visibleId),
            getEquipmentEventResponsibleUsers(),
          ]);

        if (options?.shouldApply?.() !== false) {
          setMaintenanceSettings(settingsResponse.settings);
          setResponsibleUsers(
            responsibleUsersResponse.users.map((user) => ({
              id: user.userId,
              name: user.fullName,
              position: user.position,
            })),
          );
        }
      } catch (requestError) {
        if (options?.shouldApply?.() !== false) {
          setError(getApiErrorMessage(requestError));
        }
      } finally {
        if (options?.shouldApply?.() !== false) {
          setIsLoading(false);
        }
      }
    },
    [visibleId],
  );

  useEffect(() => {
    let isMounted = true;

    setMaintenanceSettings([]);
    setResponsibleUsers([]);
    setError(null);

    if (enabled) {
      void reload({ shouldApply: () => isMounted });
    }

    return () => {
      isMounted = false;
    };
  }, [enabled, reload]);

  return {
    error,
    isLoading,
    maintenanceSettings,
    reload,
    responsibleUsers,
  };
}
