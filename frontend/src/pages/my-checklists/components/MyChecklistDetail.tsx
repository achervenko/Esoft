import { useState } from "react";
import "../../../shared/ui/AdminPage.css";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { Notice } from "../../../shared/ui/Notice";
import { checklistStatusLabels } from "../my-checklists.config";
import { ChecklistModules } from "./ChecklistModules";
import { ChecklistSummary } from "./ChecklistSummary";
import type { MyChecklistDetailProps } from "../my-checklists.types";

function formatChecklistMeta(checklist: NonNullable<MyChecklistDetailProps["checklist"]>) {
  return (
    <>
      <span>{checklist.assignedUser.fullName}</span>
    </>
  );
}

export function MyChecklistDetail({
  canMutateSelected,
  checklist,
  draftAnswers,
  emptyMessage = "Чек-лист не найден или недоступен.",
  formError,
  isActionLoading,
  isDetailLoading,
  onAnswerChange,
  onComplete,
  onReload,
  onSave,
  showRequiredErrors,
  versionConflict,
}: MyChecklistDetailProps) {
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);

  if (!checklist) {
    return (
      <section className="admin-card my-checklists-detail">
        <div className="my-checklists-detail-empty">{emptyMessage}</div>
      </section>
    );
  }

  const canEditAnswers = canMutateSelected && checklist.status === "IN_PROGRESS";
  const canShowWorkActions = checklist.status === "IN_PROGRESS" && canMutateSelected;
  const hasDetailActions = canShowWorkActions || Boolean(versionConflict);

  return (
    <section className="admin-card my-checklists-detail">
      <header className="my-checklists-detail-title">
        <div>
          <div className="my-checklists-detail-heading">
            <h2>{checklist.template.name}</h2>
            <span>{checklist.event.maintenanceType.name}</span>
          </div>
          <p className="my-checklists-detail-meta">{formatChecklistMeta(checklist)}</p>
        </div>
        <span className={`my-checklists-status ${checklist.status.toLowerCase()}`}>
          {checklistStatusLabels[checklist.status]}
        </span>
      </header>

      <ChecklistSummary checklist={checklist} />

      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {isDetailLoading ? <Notice tone="info">Загрузка чек-листа...</Notice> : null}

      <ChecklistModules
        canEdit={canEditAnswers}
        draftAnswers={draftAnswers}
        modules={checklist.modules}
        onAnswerChange={onAnswerChange}
        showRequiredErrors={showRequiredErrors}
      />

      {hasDetailActions ? (
        <div className="my-checklists-detail-actions">
          {canShowWorkActions ? (
          <>
            <button
              className="admin-secondary-button"
              disabled={isActionLoading}
              onClick={onSave}
              type="button"
            >
              Сохранить
            </button>
            <button
              className="admin-primary-button"
              disabled={isActionLoading}
              onClick={() => setIsCompleteDialogOpen(true)}
              type="button"
            >
              Завершить чек-лист
            </button>
          </>
          ) : null}
          {versionConflict ? (
            <button
              className="admin-secondary-button"
              disabled={isActionLoading || isDetailLoading}
              onClick={onReload}
              type="button"
            >
              Перезагрузить чек-лист
            </button>
          ) : null}
        </div>
      ) : null}

      {isCompleteDialogOpen ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Завершить"
          description="После завершения ответы нельзя будет изменить."
          isLoading={isActionLoading}
          loadingLabel="Завершение..."
          onCancel={() => setIsCompleteDialogOpen(false)}
          onConfirm={() => {
            setIsCompleteDialogOpen(false);
            onComplete();
          }}
          title="Завершить чек-лист?"
        />
      ) : null}
    </section>
  );
}
