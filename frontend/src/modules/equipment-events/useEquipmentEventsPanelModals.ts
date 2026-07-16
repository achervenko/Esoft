import { useCallback, useState } from "react";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import type {
  EquipmentEventsPanelActiveForm,
  EquipmentEventsPanelModalState,
} from "./equipment-events-panel.types";

type UseEquipmentEventsPanelModalsParams = {
  canCloseActionModal: boolean;
  clearActionError: () => void;
  clearMessage: () => void;
};

export function useEquipmentEventsPanelModals({
  canCloseActionModal,
  clearActionError,
  clearMessage,
}: UseEquipmentEventsPanelModalsParams) {
  const [activeForm, setActiveForm] =
    useState<EquipmentEventsPanelActiveForm | null>(null);
  const [completeCandidate, setCompleteCandidate] =
    useState<EquipmentEventItem | null>(null);
  const [cancelCandidate, setCancelCandidate] =
    useState<EquipmentEventItem | null>(null);

  const openForm = useCallback((form: EquipmentEventsPanelActiveForm) => {
    clearActionError();
    clearMessage();
    setActiveForm(form);
  }, [clearActionError, clearMessage]);

  const requestComplete = useCallback((event: EquipmentEventItem) => {
    clearActionError();
    clearMessage();
    setCompleteCandidate(event);
  }, [clearActionError, clearMessage]);

  const requestCancel = useCallback((event: EquipmentEventItem) => {
    clearActionError();
    clearMessage();
    setCancelCandidate(event);
  }, [clearActionError, clearMessage]);

  const closeForm = useCallback(() => {
    if (canCloseActionModal) {
      setActiveForm(null);
      clearActionError();
    }
  }, [canCloseActionModal, clearActionError]);

  const closeComplete = useCallback(() => {
    if (canCloseActionModal) {
      setCompleteCandidate(null);
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

  const clearComplete = useCallback(() => {
    setCompleteCandidate(null);
  }, []);

  const clearCancel = useCallback(() => {
    setCancelCandidate(null);
  }, []);

  const resetModals = useCallback(() => {
    setActiveForm(null);
    setCompleteCandidate(null);
    setCancelCandidate(null);
  }, []);

  const modalState: Omit<EquipmentEventsPanelModalState, "detailEvent"> = {
    activeForm,
    cancelCandidate,
    completeCandidate,
  };

  return {
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
  };
}
