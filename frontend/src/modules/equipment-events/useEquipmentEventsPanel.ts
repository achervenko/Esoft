import { useCallback, useEffect, useState } from "react";
import type { EquipmentStatus } from "../../shared/api/equipment/equipment.types";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
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
    clearMessage,
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
    message,
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
