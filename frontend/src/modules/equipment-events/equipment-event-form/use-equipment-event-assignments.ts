import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { MaintenanceSetting } from "../../../shared/api/maintenance/maintenance.types";

type UseEquipmentEventAssignmentsParams = {
  defaultChecklistTemplateId: string;
  maintenanceSettings: MaintenanceSetting[];
  responsibleUserIds: string[];
  setChecklistTemplateIdsByResponsible: Dispatch<
    SetStateAction<Record<string, string>>
  >;
  setMaintenanceTypeId: Dispatch<SetStateAction<string>>;
  setResponsibleUserIds: Dispatch<SetStateAction<string[]>>;
};

export function useEquipmentEventAssignments({
  defaultChecklistTemplateId,
  maintenanceSettings,
  responsibleUserIds,
  setChecklistTemplateIdsByResponsible,
  setMaintenanceTypeId,
  setResponsibleUserIds,
}: UseEquipmentEventAssignmentsParams) {
  const updateMaintenanceTypeId = useCallback(
    (nextMaintenanceTypeId: string) => {
      const nextMaintenanceSetting =
        maintenanceSettings.find(
          (setting) =>
            String(setting.maintenanceType.id) === nextMaintenanceTypeId,
        ) ?? null;
      const nextDefaultChecklistTemplateId =
        nextMaintenanceSetting?.defaultChecklistTemplate?.state === "ACTIVE"
          ? String(
              nextMaintenanceSetting.defaultChecklistTemplate
                .checklistTemplateId,
            )
          : "";

      setMaintenanceTypeId(nextMaintenanceTypeId);
      setChecklistTemplateIdsByResponsible((current) =>
        Object.fromEntries(
          responsibleUserIds.map((responsibleUserId) => [
            responsibleUserId,
            nextDefaultChecklistTemplateId || current[responsibleUserId] || "",
          ]),
        ),
      );
    },
    [
      maintenanceSettings,
      responsibleUserIds,
      setChecklistTemplateIdsByResponsible,
      setMaintenanceTypeId,
    ],
  );

  const toggleResponsible = useCallback(
    (responsibleUserId: string) => {
      setResponsibleUserIds((currentResponsibleUserIds) => {
        const isRemovingResponsible =
          currentResponsibleUserIds.includes(responsibleUserId);
        const nextResponsibleUserIds = isRemovingResponsible
          ? currentResponsibleUserIds.filter((id) => id !== responsibleUserId)
          : [...currentResponsibleUserIds, responsibleUserId];

        setChecklistTemplateIdsByResponsible((currentValue) => {
          if (isRemovingResponsible) {
            return Object.fromEntries(
              Object.entries(currentValue).filter(
                ([currentResponsibleUserId]) =>
                  currentResponsibleUserId !== responsibleUserId,
              ),
            );
          }

          return {
            ...currentValue,
            [responsibleUserId]:
              currentValue[responsibleUserId] ?? defaultChecklistTemplateId,
          };
        });

        return nextResponsibleUserIds;
      });
    },
    [
      defaultChecklistTemplateId,
      setChecklistTemplateIdsByResponsible,
      setResponsibleUserIds,
    ],
  );

  const assignChecklistTemplate = useCallback(
    (responsibleUserId: string, checklistTemplateId: string) => {
      setChecklistTemplateIdsByResponsible((currentValue) => ({
        ...currentValue,
        [responsibleUserId]: checklistTemplateId,
      }));
    },
    [setChecklistTemplateIdsByResponsible],
  );

  return {
    assignChecklistTemplate,
    toggleResponsible,
    updateMaintenanceTypeId,
  };
}
