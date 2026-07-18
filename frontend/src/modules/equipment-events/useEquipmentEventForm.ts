import { useMemo, useState, type FormEvent } from "react";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { getBusinessTodayDateString } from "./equipment-events-date";
import type {
  EquipmentEventFormMode,
  EquipmentEventFormPayload,
  ResponsibleUserOption,
} from "./equipment-event-form.types";
import {
  buildChecklistAssignments,
  buildUpdatePayload,
  getChecklistTemplateIdsByResponsible,
} from "./equipment-event-form.utils";
import {
  validateChecklistAssignments,
  validateMaintenanceType,
  validatePlannedDate,
  validateResponsibles,
} from "./equipment-event-form.validation";

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

  const selectedMaintenanceSetting = useMemo(
    () =>
      maintenanceSettings.find(
        (setting) => String(setting.maintenanceType.id) === maintenanceTypeId,
      ) ?? null,
    [maintenanceSettings, maintenanceTypeId],
  );

  const defaultChecklistTemplateId =
    selectedMaintenanceSetting?.defaultChecklistTemplate?.state === "ACTIVE"
      ? String(selectedMaintenanceSetting.defaultChecklistTemplate.checklistTemplateId)
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

  const updateMaintenanceTypeId = (nextMaintenanceTypeId: string) => {
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
  };

  const toggleResponsible = (responsibleUserId: string) => {
    const isRemovingResponsible =
      responsibleUserIds.includes(responsibleUserId);
    const nextResponsibleUserIds = isRemovingResponsible
      ? responsibleUserIds.filter((id) => id !== responsibleUserId)
      : [...responsibleUserIds, responsibleUserId];

    setResponsibleUserIds(nextResponsibleUserIds);
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
  };

  const assignChecklistTemplate = (
    responsibleUserId: string,
    checklistTemplateId: string,
  ) => {
    setChecklistTemplateIdsByResponsible((currentValue) => ({
      ...currentValue,
      [responsibleUserId]: checklistTemplateId,
    }));
  };

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (isSaving) {
      return;
    }

    const parsedMaintenanceTypeId = Number(maintenanceTypeId);
    const maintenanceTypeError = validateMaintenanceType(
      parsedMaintenanceTypeId,
    );

    if (maintenanceTypeError) {
      setError(maintenanceTypeError);
      return;
    }

    const plannedDateError = validatePlannedDate(plannedDate);

    if (plannedDateError) {
      setError(plannedDateError);
      return;
    }

    const uniqueResponsibleUserIds = [...new Set(responsibleUserIds)];
    const responsiblesError = validateResponsibles(
      uniqueResponsibleUserIds,
      unavailableResponsibleIds,
    );

    if (responsiblesError) {
      setError(responsiblesError);
      return;
    }

    const checklistAssignments = buildChecklistAssignments(
      uniqueResponsibleUserIds,
      checklistTemplateIdsByResponsible,
    );
    const checklistAssignmentsError = validateChecklistAssignments(
      checklistAssignments,
      new Set(uniqueResponsibleUserIds),
    );

    if (checklistAssignmentsError) {
      setError(checklistAssignmentsError);
      return;
    }

    const normalizedNote = note.trim() || null;

    if (mode === "edit" && event) {
      const updatePayload = buildUpdatePayload({
        checklistAssignments,
        equipmentVisibleId: equipmentVisibleId ?? event.equipment.visibleId,
        event,
        maintenanceTypeId: parsedMaintenanceTypeId,
        note: normalizedNote,
        plannedDate,
        responsibleUserIds: uniqueResponsibleUserIds,
      });

      if (Object.keys(updatePayload).length === 1) {
        setError("Нет изменений для сохранения.");
        return;
      }

      setError(null);
      onSubmit({
        checklistAssignments,
        maintenanceTypeId: parsedMaintenanceTypeId,
        note: normalizedNote,
        plannedDate,
        responsibleUserIds: uniqueResponsibleUserIds,
        updatePayload,
      });
      return;
    }

    setError(null);
    onSubmit({
      checklistAssignments,
      maintenanceTypeId: parsedMaintenanceTypeId,
      note: normalizedNote,
      plannedDate,
      responsibleUserIds: uniqueResponsibleUserIds,
    });
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
