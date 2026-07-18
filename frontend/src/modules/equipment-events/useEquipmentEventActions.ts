import { useCallback, useRef, useState } from "react";
import {
  cancelEquipmentEvent,
  createManualEquipmentEvent,
  updateCreatedEquipmentEvent,
} from "../../shared/api/equipment-events/equipment-events.api";
import type {
  CreateManualEquipmentEventPayload,
  UpdateCreatedEquipmentEventPayload,
} from "../../shared/api/equipment-events/equipment-events.types";
import { getApiErrorMessage } from "../../shared/api/api-error";

export type EquipmentEventAction =
  | "create"
  | "edit"
  | "cancel"
  | null;

type UseEquipmentEventActionsOptions = {
  reloadEvents: () => Promise<unknown>;
  visibleId: number;
};

export function useEquipmentEventActions({
  reloadEvents,
  visibleId,
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
      runAction("create", () => createManualEquipmentEvent(visibleId, payload)),
    [runAction, visibleId],
  );

  const updateEvent = useCallback(
    (eventId: number, payload: UpdateCreatedEquipmentEventPayload) =>
      runAction("edit", () => updateCreatedEquipmentEvent(eventId, payload)),
    [runAction],
  );

  const cancelEvent = useCallback(
    (eventId: number) =>
      runAction("cancel", () => cancelEquipmentEvent(eventId)),
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
