import { useCallback, useRef, useState } from "react";
import {
  cancelEvent as cancelGenericEvent,
  createEvent as createGenericEvent,
  updateCreatedEvent,
} from "../../shared/api/events/events.api";
import type {
  CreateManualEquipmentEventPayload,
  UpdateCreatedEquipmentEventPayload,
} from "./equipment-events.types";
import { getApiErrorMessage } from "../../shared/api/api-error";
import {
  assertEquipmentEventDetail,
  buildEquipmentEventTitle,
} from "./equipment-events.mappers";

export type EquipmentEventAction =
  | "create"
  | "edit"
  | "cancel"
  | null;

type UseEquipmentEventActionsOptions = {
  reloadEvents: () => Promise<unknown>;
};

export function useEquipmentEventActions({
  reloadEvents,
}: UseEquipmentEventActionsOptions) {
  const activeActionRef = useRef<EquipmentEventAction>(null);
  const [activeAction, setActiveAction] = useState<EquipmentEventAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const runAction = useCallback(
    async (
      action: Exclude<EquipmentEventAction, null>,
      request: () => Promise<unknown>,
    ) => {
      if (activeActionRef.current !== null) {
        return false;
      }

      activeActionRef.current = action;
      setActiveAction(action);
      setActionError(null);
      setRefreshError(null);

      try {
        try {
          await request();
        } catch (requestError) {
          setActionError(getApiErrorMessage(requestError));
          return false;
        }

        try {
          await reloadEvents();
        } catch (reloadError) {
          setRefreshError(
            `Действие выполнено, но не удалось обновить список событий. ${getApiErrorMessage(
              reloadError,
            )}`,
          );
        }

        return true;
      } finally {
        activeActionRef.current = null;
        setActiveAction(null);
      }
    },
    [reloadEvents],
  );

  const clearActionErrors = useCallback(() => {
    setActionError(null);
    setRefreshError(null);
  }, []);

  const createEvent = useCallback(
    (payload: CreateManualEquipmentEventPayload) =>
      runAction("create", async () => {
        const event = await createGenericEvent({
          checklistAssignments: payload.checklistAssignments,
          extension: {
            equipmentVisibleId: payload.equipmentVisibleId,
            maintenanceTypeId: payload.maintenanceTypeId,
          },
          extensionCode: "EQUIPMENT",
          note: payload.note,
          plannedDate: payload.plannedDate,
          responsibleUserIds: payload.responsibleUserIds,
          title:
            payload.title ??
            buildEquipmentEventTitle(payload.equipmentVisibleId),
        });

        assertEquipmentEventDetail(event);
      }),
    [runAction],
  );

  const updateEvent = useCallback(
    (eventId: number, payload: UpdateCreatedEquipmentEventPayload) =>
      runAction("edit", async () => {
        const { equipmentVisibleId, maintenanceTypeId, ...eventPayload } =
          payload;
        const extension =
          equipmentVisibleId !== undefined || maintenanceTypeId !== undefined
            ? {
                ...(equipmentVisibleId !== undefined
                  ? { equipmentVisibleId }
                  : {}),
                ...(maintenanceTypeId !== undefined
                  ? { maintenanceTypeId }
                  : {}),
              }
            : undefined;
        const event = await updateCreatedEvent(eventId, {
          ...eventPayload,
          ...(extension ? { extension } : {}),
        });

        assertEquipmentEventDetail(event);
      }),
    [runAction],
  );

  const cancelEvent = useCallback(
    (eventId: number, version: number) =>
      runAction("cancel", async () => {
        const event = await cancelGenericEvent(eventId, { version });

        assertEquipmentEventDetail(event);
      }),
    [runAction],
  );

  return {
    actionError,
    activeAction,
    cancelEvent,
    clearActionError: clearActionErrors,
    createEvent,
    refreshError,
    updateEvent,
  };
}
