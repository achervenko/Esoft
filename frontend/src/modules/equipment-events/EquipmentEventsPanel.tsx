import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  EquipmentEventDetail,
  EquipmentEventItem,
} from "../../shared/api/equipment-events/equipment-events.types";
import "../../shared/ui/AdminPage.css";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { Notice } from "../../shared/ui/Notice";
import { CompleteEquipmentEventModal } from "./CompleteEquipmentEventModal";
import { EquipmentEventDetailModal } from "./EquipmentEventDetailModal";
import {
  EquipmentEventFormModal,
  type EquipmentEventFormPayload,
} from "./EquipmentEventFormModal";
import { EquipmentEventsTable } from "./EquipmentEventsTable";
import { useEquipmentEventActions } from "./useEquipmentEventActions";
import { useEquipmentEventFormData } from "./useEquipmentEventFormData";
import { useEquipmentEventsList } from "./useEquipmentEventsList";
import "./EquipmentEventsPanel.css";

type EquipmentEventsPanelProps = {
  canManageEvents: boolean;
  currentUserId?: string | null;
  visibleId: number;
};

type ActiveForm =
  | { mode: "create"; event?: null }
  | { mode: "edit"; event: EquipmentEventItem };

export function EquipmentEventsPanel({
  canManageEvents,
  currentUserId = null,
  visibleId,
}: EquipmentEventsPanelProps) {
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [completeCandidate, setCompleteCandidate] =
    useState<EquipmentEventItem | null>(null);
  const [cancelCandidate, setCancelCandidate] =
    useState<EquipmentEventItem | null>(null);
  const [detailEvent, setDetailEvent] =
    useState<EquipmentEventDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
  const topLevelActionError =
    !activeForm && !completeCandidate && !cancelCandidate
      ? actionError
      : null;

  useEffect(() => {
    clearActionError();
    setMessage(null);
    setActiveForm(null);
    setCompleteCandidate(null);
    setCancelCandidate(null);
    setDetailEvent(null);
  }, [clearActionError, visibleId]);

  const openForm = (form: ActiveForm) => {
    clearActionError();
    setMessage(null);
    setActiveForm(form);
  };

  const handleFormSubmit = async (payload: EquipmentEventFormPayload) => {
    if (!activeForm) {
      return;
    }

    setMessage(null);

    if (activeForm.mode === "create") {
      const isCreated = await createEvent({
        maintenanceTypeId: payload.maintenanceTypeId,
        note: payload.note,
        plannedDate: payload.plannedDate,
        responsibleUserIds: payload.responsibleUserIds,
      });

      if (isCreated) {
        setMessage("Событие назначено.");
        setActiveForm(null);
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
        setActiveForm(null);
      }
    }
  };

  const handleOpenDetail = async (event: EquipmentEventItem) => {
    const eventDetail = await loadEventDetail(event.id);

    if (eventDetail?.id === event.id) {
      setDetailEvent(eventDetail);
    }
  };

  const handleStart = async (event: EquipmentEventItem) => {
    setMessage(null);

    if (await startEvent(event.id)) {
      setMessage("Событие взято в работу.");
    }
  };

  const handleComplete = async (factDate: string) => {
    if (!completeCandidate) {
      return;
    }

    setMessage(null);

    if (await completeEvent(completeCandidate.id, { factDate })) {
      setCompleteCandidate(null);
      setMessage("Событие завершено.");
    }
  };

  const handleCancel = async () => {
    if (!cancelCandidate) {
      return;
    }

    setMessage(null);

    if (await cancelEvent(cancelCandidate.id)) {
      setCancelCandidate(null);
      setMessage("Событие отменено.");
    }
  };

  return (
    <section className="equipment-events-panel">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {topLevelActionError ? (
        <Notice tone="error">{topLevelActionError}</Notice>
      ) : null}
      {refreshError ? <Notice tone="error">{refreshError}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <section className="admin-card equipment-events-card">
        <header>
          <div>
            <h2>События</h2>
          </div>

          {canManageEvents ? (
            <button
              className="admin-primary-button"
              disabled={
                isLoading ||
                activeAction !== null ||
                isFormDataLoading ||
                maintenanceSettings.length === 0 ||
                responsibleUsers.length === 0
              }
              onClick={() => openForm({ mode: "create" })}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              Назначить событие
            </button>
          ) : null}
        </header>

        {canManageEvents && formDataError ? (
          <div className="equipment-events-inline-error">
            <span>{formDataError}</span>
            <button
              disabled={isFormDataLoading}
              onClick={() => void reloadFormData()}
              type="button"
            >
              Повторить
            </button>
          </div>
        ) : null}

        {canManageEvents &&
        !isFormDataLoading &&
        !formDataError &&
        maintenanceSettings.length === 0 ? (
          <p className="admin-state">
            Для создания события сначала добавьте настройку обслуживания модели.
          </p>
        ) : null}

        {isDetailLoading ? (
          <p className="admin-state">Загрузка события...</p>
        ) : null}
        {isLoading ? <p className="admin-state">Загрузка событий...</p> : null}

        {!isLoading && events.length === 0 ? (
          <p className="admin-state">Для этого оборудования пока нет событий.</p>
        ) : null}

        {!isLoading && events.length > 0 ? (
          <EquipmentEventsTable
            canManageEvents={canManageEvents}
            currentUserId={currentUserId}
            events={events}
            onCancel={(event) => {
              clearActionError();
              setMessage(null);
              setCancelCandidate(event);
            }}
            onComplete={(event) => {
              clearActionError();
              setMessage(null);
              setCompleteCandidate(event);
            }}
            onEdit={(event) => openForm({ mode: "edit", event })}
            onOpen={(event) => void handleOpenDetail(event)}
            onStart={(event) => void handleStart(event)}
          />
        ) : null}
      </section>

      {activeForm ? (
        <EquipmentEventFormModal
          error={actionError}
          users={responsibleUsers}
          event={activeForm.event ?? null}
          isSaving={activeAction === "create" || activeAction === "edit"}
          maintenanceSettings={maintenanceSettings}
          mode={activeForm.mode}
          onClose={() => {
            if (activeAction === null) {
              setActiveForm(null);
              clearActionError();
            }
          }}
          onSubmit={(payload) => void handleFormSubmit(payload)}
        />
      ) : null}

      {completeCandidate ? (
        <CompleteEquipmentEventModal
          error={actionError}
          event={completeCandidate}
          isSaving={activeAction === "complete"}
          onClose={() => {
            if (activeAction === null) {
              setCompleteCandidate(null);
              clearActionError();
            }
          }}
          onSubmit={(factDate) => void handleComplete(factDate)}
        />
      ) : null}

      {cancelCandidate ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Отменить"
          description={`Событие «${cancelCandidate.maintenanceType.name}» будет отменено.`}
          error={actionError}
          isLoading={activeAction === "cancel"}
          loadingLabel="Отмена..."
          onCancel={() => {
            if (activeAction === null) {
              setCancelCandidate(null);
              clearActionError();
            }
          }}
          onConfirm={() => void handleCancel()}
          title="Отменить событие?"
          variant="danger"
        />
      ) : null}

      {detailEvent ? (
        <EquipmentEventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
        />
      ) : null}
    </section>
  );
}
