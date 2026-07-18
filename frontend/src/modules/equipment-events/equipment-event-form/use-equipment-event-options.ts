import { useMemo } from "react";
import type { EquipmentEventItem } from "../../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceSetting } from "../../../shared/api/maintenance/maintenance.types";
import type {
  EquipmentEventFormMode,
  ResponsibleUserOption,
} from "../equipment-event-form.types";

type UseEquipmentEventOptionsParams = {
  event: EquipmentEventItem | null;
  maintenanceSettings: MaintenanceSetting[];
  maintenanceTypeId: string;
  mode: EquipmentEventFormMode;
  users: ResponsibleUserOption[];
};

export function useEquipmentEventOptions({
  event,
  maintenanceSettings,
  maintenanceTypeId,
  mode,
  users,
}: UseEquipmentEventOptionsParams) {
  const selectedMaintenanceSetting = useMemo(
    () =>
      maintenanceSettings.find(
        (setting) => String(setting.maintenanceType.id) === maintenanceTypeId,
      ) ?? null,
    [maintenanceSettings, maintenanceTypeId],
  );

  const defaultChecklistTemplateId =
    selectedMaintenanceSetting?.defaultChecklistTemplate?.state === "ACTIVE"
      ? String(
          selectedMaintenanceSetting.defaultChecklistTemplate
            .checklistTemplateId,
        )
      : "";

  const maintenanceTypeOptions = useMemo(() => {
    const options = maintenanceSettings.map((setting) => ({
      label: setting.maintenanceType.name,
      value: String(setting.maintenanceType.id),
    }));

    if (
      mode === "edit" &&
      event &&
      !options.some(
        (option) => option.value === String(event.maintenanceType.id),
      )
    ) {
      return [
        {
          label: `${event.maintenanceType.name} (текущий, недоступен в настройках)`,
          value: String(event.maintenanceType.id),
        },
        ...options,
      ];
    }

    return options;
  }, [event, maintenanceSettings, mode]);

  const responsibleOptions = useMemo(() => {
    if (mode !== "edit" || !event) {
      return users;
    }

    const userIds = new Set(users.map((user) => user.id));
    const unavailableResponsibles = event.responsibles
      .filter((responsible) => !userIds.has(responsible.id))
      .map((responsible) => ({
        id: responsible.id,
        isUnavailable: true,
        name: responsible.fullName,
        position: "Ранее назначен, сейчас недоступен",
      }));

    return [...unavailableResponsibles, ...users];
  }, [event, mode, users]);

  const unavailableResponsibleIds = useMemo(
    () =>
      new Set(
        responsibleOptions
          .filter((user) => user.isUnavailable)
          .map((user) => user.id),
      ),
    [responsibleOptions],
  );

  return {
    defaultChecklistTemplateId,
    maintenanceTypeOptions,
    responsibleOptions,
    selectedMaintenanceSetting,
    unavailableResponsibleIds,
  };
}
