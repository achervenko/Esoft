import { useState } from "react";
import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";
import { formatQuestionCount } from "../../shared/lib/formatters";
import { AdminFormActions } from "../../shared/ui/AdminFormControls";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Checkbox } from "../../shared/ui/Checkbox";

type AddModuleModalProps = {
  isSaving: boolean;
  module: ChecklistModule;
  onClose: () => void;
  onSubmit: (questionIds: number[]) => void;
  questions: ChecklistQuestion[];
};

export function AddModuleModal({
  isSaving,
  module,
  onClose,
  onSubmit,
  questions,
}: AddModuleModalProps) {
  const [selectedIds, setSelectedIds] = useState(() =>
    questions.map((question) => question.id),
  );
  const [error, setError] = useState<string | null>(null);
  const selectedQuestionsCount = questions.filter((question) =>
    selectedIds.includes(question.id),
  ).length;
  const isAllSelected =
    questions.length > 0 && selectedQuestionsCount === questions.length;

  return (
    <AdminModal onClose={onClose} title={`Добавить модуль: ${module.name}`}>
      <form
        className="admin-form checklist-editor-question-picker"
        onSubmit={(event) => {
          event.preventDefault();

          if (selectedIds.length === 0) {
            setError("Выберите хотя бы один вопрос.");
            return;
          }

          onSubmit(selectedIds);
        }}
      >
        {questions.length > 0 ? (
          <div className="checklist-editor-question-picker-header">
            <span>{formatQuestionCount(selectedQuestionsCount)}</span>
            <button
              className="checklist-editor-picker-action"
              disabled={isSaving}
              onClick={() => {
                setError(null);
                setSelectedIds(
                  isAllSelected ? [] : questions.map((question) => question.id),
                );
              }}
              type="button"
            >
              {isAllSelected ? "Снять выбор" : "Выбрать все"}
            </button>
          </div>
        ) : null}
        <div className="checklist-editor-checkbox-list">
          {questions.map((question, questionIndex) => (
            <Checkbox
              checked={selectedIds.includes(question.id)}
              disabled={isSaving}
              key={question.id}
              label={
                <span className="checklist-editor-picker-option-content">
                  <span>
                    {questionIndex + 1}. {question.questionText}
                  </span>
                </span>
              }
              onChange={(checked) => {
                setError(null);
                setSelectedIds((currentIds) =>
                  checked && !currentIds.includes(question.id)
                    ? [...currentIds, question.id]
                    : currentIds.filter((id) => id !== question.id),
                );
              }}
            />
          ))}
        </div>
        {error ? <p className="admin-form-error">{error}</p> : null}
        <AdminFormActions isSaving={isSaving} onClose={onClose} />
      </form>
    </AdminModal>
  );
}
