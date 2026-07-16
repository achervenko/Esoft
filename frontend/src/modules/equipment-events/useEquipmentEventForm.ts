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
} from "./equipment-event-form.utils";
import {
  validateChecklistAssignments,
  validateMaintenanceType,
  validatePlannedDate,
  validateResponsibles,
} from "./equipment-event-form.validation";

type UseEquipmentEventFormParams = {
  event?: EquipmentEventItem | null;
  isSaving: boolean;
  maintenanceSettings: MaintenanceSetting[];
  mode: EquipmentEventFormMode;
  onSubmit: (payload: EquipmentEventFormPayload) => void;
  users: ResponsibleUserOption[];
};

export function useEquipmentEventForm({
  event = null,
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
  const [checklistAssignees, setChecklistAssignees] = useState<
    Record<number, string>
  >({});
  const [error, setError] = useState<string | null>(null);

  const selectedMaintenanceSetting = useMemo(
    () =>
      maintenanceSettings.find(
        (setting) => String(setting.maintenanceType.id) === maintenanceTypeId,
      ) ?? null,
    [maintenanceSettings, maintenanceTypeId],
  );

  const selectedChecklistTemplates =
    mode === "create"
      ? (selectedMaintenanceSetting?.checklistTemplates ?? [])
      : [];

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
    setMaintenanceTypeId(nextMaintenanceTypeId);
    setChecklistAssignees({});
  };

  const toggleResponsible = (responsibleUserId: string) => {
    const isRemovingResponsible =
      responsibleUserIds.includes(responsibleUserId);
    const nextResponsibleUserIds = isRemovingResponsible
      ? responsibleUserIds.filter((id) => id !== responsibleUserId)
      : [...responsibleUserIds, responsibleUserId];

    setResponsibleUserIds(nextResponsibleUserIds);

    if (isRemovingResponsible) {
      setChecklistAssignees((currentAssignees) =>
        Object.fromEntries(
          Object.entries(currentAssignees).filter(
            ([, assigneeId]) => assigneeId !== responsibleUserId,
          ),
        ),
      );
    }
  };

  const assignChecklist = (
    checklistTemplateId: number,
    responsibleUserId: string,
  ) => {
    setChecklistAssignees((currentAssignees) => ({
      ...currentAssignees,
      [checklistTemplateId]: responsibleUserId,
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

    const responsibleUserIdSet = new Set(uniqueResponsibleUserIds);
    const checklistAssignments = buildChecklistAssignments(
      selectedChecklistTemplates,
      checklistAssignees,
    );
    const checklistAssignmentsError = validateChecklistAssignments(
      checklistAssignments,
      responsibleUserIdSet,
    );

    if (checklistAssignmentsError) {
      setError(checklistAssignmentsError);
      return;
    }

    const normalizedNote = note.trim() || null;

    if (mode === "edit" && event) {
      const updatePayload = buildUpdatePayload({
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
        maintenanceTypeId: parsedMaintenanceTypeId,
        checklistAssignments,
        note: normalizedNote,
        plannedDate,
        responsibleUserIds: uniqueResponsibleUserIds,
        updatePayload,
      });
      return;
    }

    setError(null);
    onSubmit({
      maintenanceTypeId: parsedMaintenanceTypeId,
      checklistAssignments,
      note: normalizedNote,
      plannedDate,
      responsibleUserIds: uniqueResponsibleUserIds,
    });
  };

  return {
    assignChecklist,
    checklistAssignees,
    error,
    handleSubmit,
    maintenanceTypeId,
    maintenanceTypeOptions,
    note,
    plannedDate,
    responsibleOptions,
    responsibleUserIds,
    selectedChecklistTemplates,
    setMaintenanceTypeId: updateMaintenanceTypeId,
    setNote,
    setPlannedDate,
    toggleResponsible,
  };
}
