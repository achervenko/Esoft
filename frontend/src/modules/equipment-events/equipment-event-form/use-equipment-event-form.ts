import { useState, type FormEvent } from "react";
import type { EquipmentEventItem } from "../../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceSetting } from "../../../shared/api/maintenance/maintenance.types";
import { getBusinessTodayDateString } from "../../../shared/lib/business-date";
import type {
  EquipmentEventFormMode,
  EquipmentEventFormPayload,
  ResponsibleUserOption,
} from "../equipment-event-form.types";
import { getChecklistTemplateIdsByResponsible } from "../equipment-event-form.utils";
import { prepareEquipmentEventFormSubmit } from "./equipment-event-form-submit";
import { useEquipmentEventAssignments } from "./use-equipment-event-assignments";
import { useEquipmentEventOptions } from "./use-equipment-event-options";

type UseEquipmentEventFormParams = {
  event?: EquipmentEventItem | null;
  equipmentVisibleId?: number;
  isSaving: boolean;
  maintenanceSettings: MaintenanceSetting[];
  mode: EquipmentEventFormMode;
  onSubmit: (payload: EquipmentEventFormPayload) => void;
  users: ResponsibleUserOption[];
};

export function useEquipmentEventForm({
  event = null,
  equipmentVisibleId,
  isSaving,
  maintenanceSettings,
  mode,
  onSubmit,
  users,
}: UseEquipmentEventFormParams) {
  const [maintenanceTypeId, setMaintenanceTypeId] = useState(
    event ? String(event.maintenanceType.id) : "",
  );
  const [plannedDate, setPlannedDate] = useState(
    event?.plannedDate ??
      (mode === "create" ? getBusinessTodayDateString() : ""),
  );
  const [note, setNote] = useState(event?.note ?? "");
  const [responsibleUserIds, setResponsibleUserIds] = useState(
    event?.responsibles.map((user) => user.id) ?? [],
  );
  const [checklistTemplateIdsByResponsible, setChecklistTemplateIdsByResponsible] =
    useState<Record<string, string>>(
      event ? getChecklistTemplateIdsByResponsible(event.checklists) : {},
    );
  const [error, setError] = useState<string | null>(null);

  const {
    defaultChecklistTemplateId,
    maintenanceTypeOptions,
    responsibleOptions,
    selectedMaintenanceSetting,
    unavailableResponsibleIds,
  } = useEquipmentEventOptions({
    event,
    maintenanceSettings,
    maintenanceTypeId,
    mode,
    users,
  });

  const {
    assignChecklistTemplate,
    toggleResponsible,
    updateMaintenanceTypeId,
  } = useEquipmentEventAssignments({
    defaultChecklistTemplateId,
    maintenanceSettings,
    responsibleUserIds,
    setChecklistTemplateIdsByResponsible,
    setMaintenanceTypeId,
    setResponsibleUserIds,
  });

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (isSaving) {
      return;
    }

    const result = prepareEquipmentEventFormSubmit({
      checklistTemplateIdsByResponsible,
      equipmentVisibleId,
      event,
      maintenanceTypeId,
      mode,
      note,
      plannedDate,
      responsibleUserIds,
      unavailableResponsibleIds,
    });

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setError(null);
    onSubmit(result.payload);
  };

  return {
    assignChecklistTemplate,
    checklistTemplateIdsByResponsible,
    defaultChecklistTemplateId,
    error,
    handleSubmit,
    maintenanceTypeId,
    maintenanceTypeOptions,
    note,
    plannedDate,
    responsibleOptions,
    responsibleUserIds,
    selectedMaintenanceSetting,
    setMaintenanceTypeId: updateMaintenanceTypeId,
    setNote,
    setPlannedDate,
    toggleResponsible,
  };
}
