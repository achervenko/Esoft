import { GripVertical, Pencil, Power } from "lucide-react";
import type { KeyboardEvent } from "react";
import {
  checklistAnswerTypeLabels,
  type ChecklistQuestion,
} from "../../shared/api/checklists";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";
import type { CatalogDragProps, CatalogDragState } from "./catalog-reorder.types";
import { stopCardEvent } from "./catalog-panel.utils";

type CatalogQuestionCardProps = {
  activeQuestionIndex: number;
  canActivate: boolean;
  canReorder: boolean;
  dragOverIndex: number | null;
  dragProps?: CatalogDragProps;
  dragState: CatalogDragState;
  onEdit: (question: ChecklistQuestion) => void;
  onReorder: (sourceId: number, targetIndex: number) => void;
  onToggleStatus: (question: ChecklistQuestion) => void;
  pendingQuestionIds: Set<number>;
  question: ChecklistQuestion;
  selectedGroup: SelectedQuestionGroup;
};

export function CatalogQuestionCard({
  activeQuestionIndex,
  canActivate,
  canReorder,
  dragOverIndex,
  dragProps,
  dragState,
  onEdit,
  onReorder,
  onToggleStatus,
  pendingQuestionIds,
  question,
  selectedGroup,
}: CatalogQuestionCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (!canReorder || !event.altKey) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onReorder(question.id, Math.max(0, activeQuestionIndex - 1));
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onReorder(question.id, activeQuestionIndex + 2);
    }
  };

  return (
    <div
      className={`checklist-order-item checklist-catalog-question-card question${
        !question.isActive ? " inactive" : ""
      }${
        dragState?.kind === "question" && dragState.id === question.id
          ? " dragging"
          : ""
      }`}
      data-catalog-question-item={canReorder ? "true" : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={canReorder ? 0 : undefined}
      {...(canReorder ? dragProps : undefined)}
    >
      {dragState?.kind === "question" &&
      dragOverIndex === activeQuestionIndex ? (
        <span className="checklist-order-drop-line" />
      ) : null}
      {canReorder ? (
        <GripVertical aria-hidden="true" size={18} />
      ) : (
        <span aria-hidden="true" className="checklist-catalog-drag-spacer" />
      )}
      <div className="checklist-catalog-question-content">
        <strong>
          {selectedGroup.kind === "module" && question.sortOrder
            ? `${question.sortOrder}. `
            : ""}
          {question.questionText}
        </strong>
        <small>{checklistAnswerTypeLabels[question.answerType]}</small>
      </div>
      <span className="admin-table-actions">
        <button
          aria-label="Редактировать вопрос"
          className="admin-icon-button"
          data-no-drag="true"
          onDoubleClick={stopCardEvent}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(question);
          }}
          onPointerDown={stopCardEvent}
          title="Редактировать"
          type="button"
        >
          <Pencil size={17} />
        </button>
        <button
          aria-label={
            question.isActive ? "Деактивировать вопрос" : "Активировать вопрос"
          }
          className={`admin-icon-button checklist-status-toggle${
            question.isActive ? " active" : " inactive"
          }`}
          data-no-drag="true"
          disabled={
            pendingQuestionIds.has(question.id) ||
            (!question.isActive && !canActivate)
          }
          onDoubleClick={stopCardEvent}
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatus(question);
          }}
          onPointerDown={stopCardEvent}
          title={question.isActive ? "Деактивировать" : "Активировать"}
          type="button"
        >
          <Power size={17} />
        </button>
      </span>
    </div>
  );
}
