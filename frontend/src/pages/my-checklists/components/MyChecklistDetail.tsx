import "../../../shared/ui/AdminPage.css";
import { Notice } from "../../../shared/ui/Notice";
import { checklistStatusLabels } from "../my-checklists.config";
import { ChecklistModules } from "./ChecklistModules";
import { ChecklistSummary } from "./ChecklistSummary";
import type { MyChecklistDetailProps } from "../my-checklists.types";

export function MyChecklistDetail({
  canMutateSelected,
  checklist,
  draftAnswers,
  formError,
  isActionLoading,
  isDetailLoading,
  onAnswerChange,
  onComplete,
  onReload,
  onSave,
  onStart,
  versionConflict,
}: MyChecklistDetailProps) {
  if (!checklist) {
    return (
      <section className="admin-card my-checklists-detail">
        <div className="my-checklists-detail-empty">
          Выберите чек-лист из списка, чтобы открыть карточку и работу по вопросам.
        </div>
      </section>
    );
  }

  const canEditAnswers = canMutateSelected && checklist.status === "IN_PROGRESS";

  return (
    <section className="admin-card my-checklists-detail">
      <header className="my-checklists-detail-title">
        <div>
          <h2>{checklist.template.name}</h2>
          <p className="my-checklists-detail-meta">
            {checklist.assignedUser.fullName} • {checklist.event.maintenanceType.name}
          </p>
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
      />

      <div className="my-checklists-detail-actions">
        {checklist.status === "CREATED" && canMutateSelected ? (
          <button
            className="admin-primary-button"
            disabled={isActionLoading}
            onClick={onStart}
            type="button"
          >
            Начать
          </button>
        ) : null}
        {checklist.status === "IN_PROGRESS" && canMutateSelected ? (
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
              onClick={onComplete}
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
    </section>
  );
}
