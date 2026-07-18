import { Plus } from "lucide-react";
import {
  Fragment,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  checklistAnswerTypeLabels,
  type ChecklistQuestion,
} from "../../shared/api/checklists";
import { CatalogQuestionCard } from "./CatalogQuestionCard";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";
import type { CatalogDragItem, CatalogDragState } from "./catalog-reorder.types";

type CatalogQuestionsColumnProps = {
  activeQuestionIds: number[];
  dragOverIndex: number | null;
  dragState: CatalogDragState;
  getQuestionDragProps: (item: CatalogDragItem) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  groupQuestions: ChecklistQuestion[];
  isSelectedModuleActive: boolean;
  isSavingQuestions: boolean;
  onCreateQuestion: (moduleId: number | null) => void;
  onEditQuestion: (question: ChecklistQuestion) => void;
  onQuestionSearchChange: (value: string) => void;
  onReorderQuestions: (sourceId: number, targetIndex: number) => void;
  onToggleQuestionStatus: (question: ChecklistQuestion) => void;
  pendingQuestionIds: Set<number>;
  questionListRef: RefObject<HTMLDivElement | null>;
  questionSearch: string;
  selectedGroup: SelectedQuestionGroup;
  selectedModuleId: number | null;
  title: string;
};

export function CatalogQuestionsColumn({
  activeQuestionIds,
  dragOverIndex,
  dragState,
  getQuestionDragProps,
  groupQuestions,
  isSelectedModuleActive,
  isSavingQuestions,
  onCreateQuestion,
  onEditQuestion,
  onQuestionSearchChange,
  onReorderQuestions,
  onToggleQuestionStatus,
  pendingQuestionIds,
  questionListRef,
  questionSearch,
  selectedGroup,
  selectedModuleId,
  title,
}: CatalogQuestionsColumnProps) {
  const isQuestionSearchActive = Boolean(questionSearch.trim());
  const canCreateQuestion =
    selectedGroup.kind === "unassigned" || isSelectedModuleActive;
  const canActivateQuestion =
    selectedGroup.kind === "unassigned" || isSelectedModuleActive;

  return (
    <section className="checklist-order-column checklist-catalog-column">
      <header>
        <h2>{title}</h2>
        <button
          className="admin-primary-button"
          disabled={!canCreateQuestion}
          onClick={() => onCreateQuestion(selectedModuleId)}
          type="button"
        >
          <Plus size={18} />
          Добавить вопрос
        </button>
      </header>

      <div className="checklist-admin-filters">
        <input
          aria-label="Поиск по вопросам"
          className="checklist-catalog-question-search"
          onChange={(event) => onQuestionSearchChange(event.target.value)}
          placeholder="Поиск по вопросам"
          value={questionSearch}
        />
      </div>
      {isQuestionSearchActive && selectedGroup.kind === "module" ? (
        <p className="admin-state">Очистите поиск, чтобы изменить порядок.</p>
      ) : null}

      {groupQuestions.length === 0 ? (
        <p className="admin-state">
          {isQuestionSearchActive
            ? "Вопросы не найдены."
            : selectedGroup.kind === "unassigned"
            ? "Вопросов без модуля пока нет."
            : "В этом модуле пока нет вопросов."}
        </p>
      ) : (
        <div
          className={`checklist-order-list${isSavingQuestions ? " saving" : ""}`}
          ref={questionListRef}
        >
          {groupQuestions.map((question) => {
            const canReorder =
              selectedGroup.kind === "module" &&
              isSelectedModuleActive &&
              question.isActive &&
              !isQuestionSearchActive;
            const activeQuestionIndex = activeQuestionIds.indexOf(question.id);

            return (
              <Fragment key={question.id}>
                <CatalogQuestionCard
                  activeQuestionIndex={activeQuestionIndex}
                  canActivate={canActivateQuestion}
                  canReorder={canReorder}
                  dragOverIndex={dragOverIndex}
                  dragProps={getQuestionDragProps({
                    id: question.id,
                    kind: "question",
                    subtitle: checklistAnswerTypeLabels[question.answerType],
                    title: question.questionText,
                  })}
                  dragState={dragState}
                  onEdit={onEditQuestion}
                  onReorder={onReorderQuestions}
                  onToggleStatus={onToggleQuestionStatus}
                  pendingQuestionIds={pendingQuestionIds}
                  question={question}
                  selectedGroup={selectedGroup}
                />
                {dragState?.kind === "question" &&
                dragOverIndex === activeQuestionIds.length &&
                activeQuestionIndex === activeQuestionIds.length - 1 ? (
                  <span className="checklist-order-drop-line after" />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
