import { useMemo, useState } from "react";
import type {
  EquipmentEventItem,
  UpdateCreatedEquipmentEventPayload,
} from "../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { getBusinessTodayDateString } from "./equipment-events-date";

export type EquipmentEventFormPayload = {
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
  updatePayload?: UpdateCreatedEquipmentEventPayload;
};

export type ResponsibleUserOption = {
  id: string;
  isUnavailable?: boolean;
  name: string;
  position: string;
};

type EquipmentEventFormModalProps = {
  error?: string | null;
  users: ResponsibleUserOption[];
  event?: EquipmentEventItem | null;
  isSaving: boolean;
  maintenanceSettings: MaintenanceSetting[];
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (payload: EquipmentEventFormPayload) => void;
};

export function EquipmentEventFormModal({
  error: serverError = null,
  users,
  event = null,
  isSaving,
  maintenanceSettings,
  mode,
  onClose,
  onSubmit,
}: EquipmentEventFormModalProps) {
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
  const [error, setError] = useState<string | null>(null);

  const maintenanceTypeOptions = useMemo(
    () => {
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
    },
    [event, maintenanceSettings, mode],
  );

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

  const toggleResponsible = (responsibleUserId: string) => {
    setResponsibleUserIds((currentIds) =>
      currentIds.includes(responsibleUserId)
        ? currentIds.filter((id) => id !== responsibleUserId)
        : [...currentIds, responsibleUserId],
    );
  };

  const handleSubmit = (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (isSaving) {
      return;
    }

    const parsedMaintenanceTypeId = Number(maintenanceTypeId);

    if (
      !Number.isSafeInteger(parsedMaintenanceTypeId) ||
      parsedMaintenanceTypeId <= 0
    ) {
      setError("Выберите вид обслуживания.");
      return;
    }

    if (!plannedDate) {
      setError("Укажите плановую дату.");
      return;
    }

    const uniqueResponsibleUserIds = [...new Set(responsibleUserIds)];

    if (uniqueResponsibleUserIds.length === 0) {
      setError("Укажите хотя бы одного ответственного.");
      return;
    }

    if (
      uniqueResponsibleUserIds.some((responsibleUserId) =>
        unavailableResponsibleIds.has(responsibleUserId),
      )
    ) {
      setError(
        "Замените ранее назначенных недоступных ответственных перед сохранением.",
      );
      return;
    }

    const normalizedNote = note.trim() || null;

    if (mode === "edit" && event) {
      const updatePayload: UpdateCreatedEquipmentEventPayload = {
        version: event.version,
      };

      if (parsedMaintenanceTypeId !== event.maintenanceType.id) {
        updatePayload.maintenanceTypeId = parsedMaintenanceTypeId;
      }

      if (plannedDate !== event.plannedDate) {
        updatePayload.plannedDate = plannedDate;
      }

      if (normalizedNote !== event.note) {
        updatePayload.note = normalizedNote;
      }

      if (
        normalizeIds(uniqueResponsibleUserIds).join(",") !==
        normalizeIds(event.responsibles.map((user) => user.id)).join(",")
      ) {
        updatePayload.responsibleUserIds = uniqueResponsibleUserIds;
      }

      if (Object.keys(updatePayload).length === 1) {
        setError("Нет изменений для сохранения.");
        return;
      }

      setError(null);
      onSubmit({
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
      maintenanceTypeId: parsedMaintenanceTypeId,
      note: normalizedNote,
      plannedDate,
      responsibleUserIds: uniqueResponsibleUserIds,
    });
  };

  return (
    <AdminModal
      onClose={onClose}
      title={mode === "edit" ? "Редактирование события" : "Назначить событие"}
    >
      <form className="admin-form equipment-event-form" onSubmit={handleSubmit}>
        <SelectDropdown
          label="Вид обслуживания"
          onChange={setMaintenanceTypeId}
          options={maintenanceTypeOptions}
          placeholder="Выберите вид обслуживания"
          required
          value={maintenanceTypeId}
        />

        <label className="form-field">
          <span>
            Плановая дата<b aria-hidden="true">*</b>
          </span>
          <input
            onChange={(inputEvent) => setPlannedDate(inputEvent.target.value)}
            type="date"
            value={plannedDate}
          />
        </label>

        <fieldset className="equipment-event-responsibles">
          <legend>Ответственные</legend>
          <div>
            {responsibleOptions.map((user) => {
              const isChecked = responsibleUserIds.includes(user.id);

              return (
                <label key={user.id}>
                  <input
                    checked={isChecked}
                    disabled={user.isUnavailable && !isChecked}
                    onChange={() => toggleResponsible(user.id)}
                    type="checkbox"
                  />
                  <span>{user.name}</span>
                  {user.position ? <small>{user.position}</small> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="form-field">
          <span>Комментарий</span>
          <textarea
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            placeholder="Комментарий к событию"
            rows={4}
            value={note}
          />
        </label>

        {error || serverError ? (
          <p className="admin-form-error">{error ?? serverError}</p>
        ) : null}

        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function normalizeIds(ids: string[]) {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}
