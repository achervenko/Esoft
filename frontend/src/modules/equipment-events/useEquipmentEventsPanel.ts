import { useCallback, useEffect, useState } from "react";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import type { EquipmentEventFormPayload } from "./EquipmentEventFormModal";
import { useEquipmentEventActions } from "./useEquipmentEventActions";
import { useEquipmentEventDetail } from "./useEquipmentEventDetail";
import { useEquipmentEventFormData } from "./useEquipmentEventFormData";
import { useEquipmentEventsList } from "./useEquipmentEventsList";
import { useEquipmentEventsPanelModals } from "./useEquipmentEventsPanelModals";

type UseEquipmentEventsPanelParams = {
  canManageEvents: boolean;
  visibleId: number;
};

export function useEquipmentEventsPanel({
  canManageEvents,
  visibleId,
}: UseEquipmentEventsPanelParams) {
  const [message, setMessage] = useState<string | null>(null);
  const clearMessage = useCallback(() => setMessage(null), []);

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
    completeEvent,
    createEvent,
    refreshError,
    startEvent,
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
    clearComplete,
    clearForm,
    closeCancel,
    closeComplete,
    closeForm,
    completeCandidate,
    modalState,
    openForm,
    requestCancel,
    requestComplete,
    resetModals,
  } = useEquipmentEventsPanelModals({
    canCloseActionModal: activeAction === null,
    clearActionError,
    clearMessage,
  });

  const topLevelActionError =
    !activeForm && !completeCandidate && !cancelCandidate ? actionError : null;
  const canEditEvents =
    canManageEvents &&
    !isFormDataLoading &&
    formDataError === null &&
    responsibleUsers.length > 0;
  const isCreateDisabled =
    isLoading ||
    activeAction !== null ||
    isFormDataLoading ||
    formDataError !== null ||
    maintenanceSettings.length === 0 ||
    responsibleUsers.length === 0;
  const shouldShowMissingSettings =
    canManageEvents &&
    !isFormDataLoading &&
    !formDataError &&
    maintenanceSettings.length === 0;

  useEffect(() => {
    clearActionError();
    clearMessage();
    resetModals();
    resetDetail();
  }, [clearActionError, clearMessage, resetDetail, resetModals, visibleId]);

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

    clearMessage();

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
        setMessage("Событие назначено.");
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
        setMessage("Событие обновлено.");
        clearForm();
      }
    }
  };

  const handleStart = async (event: EquipmentEventItem) => {
    clearMessage();

    if (await startEvent(event.id)) {
      setMessage("Событие взято в работу.");
    }
  };

  const handleComplete = async (factDate: string) => {
    if (!completeCandidate) {
      return;
    }

    clearMessage();

    if (await completeEvent(completeCandidate.id, { factDate })) {
      clearComplete();
      setMessage("Событие завершено.");
    }
  };

  const handleCancel = async () => {
    if (!cancelCandidate) {
      return;
    }

    clearMessage();

    if (await cancelEvent(cancelCandidate.id)) {
      clearCancel();
      setMessage("Событие отменено.");
    }
  };

  return {
    activeAction,
    actionError,
    canEditEvents,
    closeCancel,
    closeComplete,
    closeDetail,
    closeForm,
    events,
    formDataError,
    handleCancel,
    handleComplete,
    handleEdit,
    handleFormSubmit,
    handleOpenDetail,
    handleStart,
    isCreateDisabled,
    isDetailLoading,
    isFormDataLoading,
    isLoading,
    listError: error,
    maintenanceSettings,
    checklistTemplates,
    message,
    modalState: {
      ...modalState,
      detailEvent,
    },
    openCreateForm,
    refreshError,
    reloadFormData,
    requestCancel,
    requestComplete,
    responsibleUsers,
    shouldShowMissingSettings,
    topLevelActionError,
  };
}
