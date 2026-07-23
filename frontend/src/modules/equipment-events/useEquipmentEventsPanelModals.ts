import { useCallback, useState } from "react";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import type {
  EquipmentEventsPanelActiveForm,
  EquipmentEventsPanelModalState,
} from "./equipment-events-panel.types";

type UseEquipmentEventsPanelModalsParams = {
  canCloseActionModal: boolean;
  clearActionError: () => void;
};

export function useEquipmentEventsPanelModals({
  canCloseActionModal,
  clearActionError,
}: UseEquipmentEventsPanelModalsParams) {
  const [activeForm, setActiveForm] =
    useState<EquipmentEventsPanelActiveForm | null>(null);
  const [cancelCandidate, setCancelCandidate] =
    useState<EquipmentEventItem | null>(null);

  const openForm = useCallback((form: EquipmentEventsPanelActiveForm) => {
    clearActionError();
    setActiveForm(form);
  }, [clearActionError]);

  const requestCancel = useCallback((event: EquipmentEventItem) => {
    clearActionError();
    setCancelCandidate(event);
  }, [clearActionError]);

  const closeForm = useCallback(() => {
    if (canCloseActionModal) {
      setActiveForm(null);
      clearActionError();
    }
  }, [canCloseActionModal, clearActionError]);

  const closeCancel = useCallback(() => {
    if (canCloseActionModal) {
      setCancelCandidate(null);
      clearActionError();
    }
  }, [canCloseActionModal, clearActionError]);

  const clearForm = useCallback(() => {
    setActiveForm(null);
  }, []);

  const clearCancel = useCallback(() => {
    setCancelCandidate(null);
  }, []);

  const resetModals = useCallback(() => {
    setActiveForm(null);
    setCancelCandidate(null);
  }, []);

  const modalState: Omit<EquipmentEventsPanelModalState, "detailEvent"> = {
    activeForm,
    cancelCandidate,
  };

  return {
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
  };
}
