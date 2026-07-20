import { useState } from "react";
import "../../../shared/ui/AdminPage.css";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { Notice } from "../../../shared/ui/Notice";
import { checklistStatusLabels } from "../my-checklists.config";
import { ChecklistModules } from "./ChecklistModules";
import { ChecklistSummary } from "./ChecklistSummary";
import type { MyChecklistDetailProps } from "../my-checklists.types";
import type { ChecklistResult } from "../../../shared/api/checklists";

const checklistResultOptions: Array<{
  label: string;
  value: ChecklistResult;
}> = [
  { label: "Пройден", value: "PASSED" },
  { label: "Не пройден", value: "FAILED" },
  { label: "С замечаниями", value: "WITH_REMARKS" },
];

function formatChecklistMeta(
  checklist: NonNullable<MyChecklistDetailProps["checklist"]>,
) {
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
  const [completeResult, setCompleteResult] =
    useState<ChecklistResult>("PASSED");

  if (!checklist) {
    return (
      <section className="admin-card my-checklists-detail">
        <div className="my-checklists-detail-empty">{emptyMessage}</div>
      </section>
    );
  }

  const canMutateCurrent =
    canMutateSelected &&
    checklist.status === "IN_PROGRESS" &&
    !isDetailLoading &&
    !versionConflict;
  const canEditAnswers = canMutateCurrent;
  const canShowWorkActions = canMutateCurrent;
  const hasDetailActions = canShowWorkActions || Boolean(versionConflict);

  return (
    <section className="admin-card my-checklists-detail">
      <header className="my-checklists-detail-title">
        <div>
          <div className="my-checklists-detail-heading">
            <h2>{checklist.template.name}</h2>
            <span>{checklist.event.maintenanceType.name}</span>
          </div>
          <p className="my-checklists-detail-meta">
            {formatChecklistMeta(checklist)}
          </p>
        </div>
        <span
          className={`my-checklists-status ${checklist.status.toLowerCase()}`}
        >
          {checklistStatusLabels[checklist.status]}
        </span>
      </header>

      <ChecklistSummary checklist={checklist} />

      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {isDetailLoading ? (
        <Notice tone="info">Загрузка чек-листа...</Notice>
      ) : null}

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
                disabled={
                  isActionLoading || isDetailLoading || Boolean(versionConflict)
                }
                onClick={onSave}
                type="button"
              >
                Сохранить
              </button>
              <button
                className="admin-primary-button"
                disabled={
                  isActionLoading || isDetailLoading || Boolean(versionConflict)
                }
                onClick={() => {
                  setCompleteResult("PASSED");
                  setIsCompleteDialogOpen(true);
                }}
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

      {isCompleteDialogOpen && canMutateCurrent ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Завершить"
          description="После завершения ответы нельзя будет изменить."
          isLoading={isActionLoading}
          loadingLabel="Завершение..."
          onCancel={() => setIsCompleteDialogOpen(false)}
          onConfirm={() => {
            setIsCompleteDialogOpen(false);
            onComplete(completeResult);
          }}
          title="Завершить чек-лист?"
        >
          <div className="my-checklists-complete-result">
            {checklistResultOptions.map((option) => (
              <label key={option.value}>
                <input
                  checked={completeResult === option.value}
                  disabled={
                    isActionLoading ||
                    isDetailLoading ||
                    Boolean(versionConflict)
                  }
                  name="checklist-result"
                  onChange={() => setCompleteResult(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
