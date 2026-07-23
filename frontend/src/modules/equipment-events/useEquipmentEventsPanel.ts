import { useEffect, useRef } from "react";
import type { EquipmentStatus } from "../../shared/api/equipment/equipment.types";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { useNotifications } from "../../shared/ui/notifications";
import type { EquipmentEventFormPayload } from "./equipment-event-form.types";
import { useEquipmentEventActions } from "./useEquipmentEventActions";
import { useEquipmentEventDetail } from "./useEquipmentEventDetail";
import { useEquipmentEventFormData } from "./useEquipmentEventFormData";
import { useEquipmentEventsList } from "./useEquipmentEventsList";
import { useEquipmentEventsPanelModals } from "./useEquipmentEventsPanelModals";

type UseEquipmentEventsPanelParams = {
  canManageEvents: boolean;
  equipmentStatus: EquipmentStatus;
  visibleId: number;
};

export function useEquipmentEventsPanel({
  canManageEvents,
  equipmentStatus,
  visibleId,
}: UseEquipmentEventsPanelParams) {
  const { notifyError } = useNotifications();
  const notifiedErrorsRef = useRef(new Set<string>());

  const {
    events,
    error,
    isDetailLoading,
    isLoading,
    loadEventDetail,
    reloadEvents,
  } = useEquipmentEventsList(visibleId);
  const {
    error: formDataError,
    isLoading: isFormDataLoading,
    checklistTemplates,
    maintenanceSettings,
    reload: reloadFormData,
    responsibleUsers,
  } = useEquipmentEventFormData(visibleId, canManageEvents);
  const {
    actionError,
    activeAction,
    cancelEvent,
    clearActionError,
    createEvent,
    refreshError,
    updateEvent,
  } = useEquipmentEventActions({ reloadEvents, visibleId });
  const {
    closeDetail,
    detailEvent,
    handleOpenDetail,
    resetDetail,
  } = useEquipmentEventDetail({ loadEventDetail });
  const {
    activeForm,
    cancelCandidate,
    clearCancel,
    clearForm,
    closeCancel,
    closeForm,
    modalState,
    openForm,
    requestCancel,
    resetModals,
  } = useEquipmentEventsPanelModals({
    canCloseActionModal: activeAction === null,
    clearActionError,
  });

  const topLevelActionError = !activeForm && !cancelCandidate ? actionError : null;
  const isWrittenOff = equipmentStatus === "WRITTEN_OFF";
  const canEditEvents =
    canManageEvents &&
    !isWrittenOff &&
    !isLoading &&
    activeAction === null &&
    !isFormDataLoading &&
    formDataError === null &&
    responsibleUsers.length > 0;
  const isCreateDisabled =
    isLoading ||
    isWrittenOff ||
    activeAction !== null ||
    isFormDataLoading ||
    formDataError !== null ||
    maintenanceSettings.length === 0 ||
    responsibleUsers.length === 0;
  const shouldShowMissingSettings =
    canManageEvents &&
    !isWrittenOff &&
    !isFormDataLoading &&
    !formDataError &&
    maintenanceSettings.length === 0;
  const shouldShowWrittenOffState = canManageEvents && isWrittenOff;

  useEffect(() => {
    clearActionError();
    resetModals();
    resetDetail();
    notifiedErrorsRef.current.clear();
  }, [clearActionError, resetDetail, resetModals, visibleId]);

  useEffect(() => {
    notifyEquipmentEventsError(
      "list",
      "Не удалось загрузить события оборудования",
      error,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [error, notifyError]);

  useEffect(() => {
    notifyEquipmentEventsError(
      "form-data",
      "Не удалось загрузить данные для события",
      formDataError,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [formDataError, notifyError]);

  useEffect(() => {
    notifyEquipmentEventsError(
      "action",
      "Не удалось сохранить событие",
      actionError,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [actionError, notifyError]);

  useEffect(() => {
    notifyEquipmentEventsError(
      "refresh",
      "Не удалось обновить список событий",
      refreshError,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [notifyError, refreshError]);

  const openCreateForm = () => {
    openForm({ mode: "create" });
  };

  const handleEdit = (event: EquipmentEventItem) => {
    if (!canEditEvents) {
      return;
    }

    openForm({ mode: "edit", event });
  };

  const handleFormSubmit = async (payload: EquipmentEventFormPayload) => {
    if (!activeForm) {
      return;
    }

    if (activeForm.mode === "create") {
      const isCreated = await createEvent({
        checklistAssignments: payload.checklistAssignments,
        equipmentVisibleId: visibleId,
        maintenanceTypeId: payload.maintenanceTypeId,
        note: payload.note,
        plannedDate: payload.plannedDate,
        responsibleUserIds: payload.responsibleUserIds,
      });

      if (isCreated) {
        clearForm();
      }

      return;
    }

    if (payload.updatePayload) {
      const isUpdated = await updateEvent(
        activeForm.event.id,
        payload.updatePayload,
      );

      if (isUpdated) {
        clearForm();
      }
    }
  };

  const handleCancel = async () => {
    if (!cancelCandidate) {
      return;
    }

    if (await cancelEvent(cancelCandidate.id)) {
      clearCancel();
    }
  };

  return {
    activeAction,
    actionError,
    canEditEvents,
    closeCancel,
    closeDetail,
    closeForm,
    events,
    formDataError,
    handleCancel,
    handleEdit,
    handleFormSubmit,
    handleOpenDetail,
    isCreateDisabled,
    isDetailLoading,
    isFormDataLoading,
    isLoading,
    listError: error,
    maintenanceSettings,
    checklistTemplates,
    modalState: {
      ...modalState,
      detailEvent,
    },
    openCreateForm,
    refreshError,
    reloadFormData,
    requestCancel,
    responsibleUsers,
    shouldShowMissingSettings,
    shouldShowWrittenOffState,
    topLevelActionError,
  };
}

function notifyEquipmentEventsError(
  key: string,
  title: string,
  message: string | null,
  notifiedErrors: Set<string>,
  notifyError: (title: string, message?: string) => string,
) {
  if (!message) {
    removeNotifiedErrorKey(key, notifiedErrors);
    return;
  }

  const fingerprint = `${key}:${message}`;

  if (notifiedErrors.has(fingerprint)) {
    return;
  }

  notifiedErrors.add(fingerprint);
  notifyError(title, message);
}

function removeNotifiedErrorKey(key: string, notifiedErrors: Set<string>) {
  const prefix = `${key}:`;

  for (const fingerprint of notifiedErrors) {
    if (fingerprint.startsWith(prefix)) {
      notifiedErrors.delete(fingerprint);
    }
  }
}
