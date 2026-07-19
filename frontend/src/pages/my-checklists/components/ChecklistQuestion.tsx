import { useCallback } from "react";
import { checklistAnswerTypeLabels } from "../../../shared/api/checklists";
import { hasDraftValue } from "../my-checklists.answers";
import { formatDateTime } from "../my-checklists.utils";
import type { ChecklistQuestionProps } from "../my-checklists.types";
import { ChecklistAnswerField } from "./ChecklistAnswerField";

function formatQuestionMeta(question: ChecklistQuestionProps["question"]) {
  if (question.answeredAt) {
    return `Ответ: ${formatDateTime(question.answeredAt)}`;
  }

  return checklistAnswerTypeLabels[question.answerType];
}

export function ChecklistQuestion({
  canEdit,
  onAnswerChange,
  question,
  showRequiredError,
  value,
}: ChecklistQuestionProps) {
  const hasError =
    showRequiredError &&
    question.isRequired &&
    !hasDraftValue(question.answerType, value);
  const handleAnswerChange = useCallback(
    (nextValue: string) => {
      onAnswerChange(question.checklistDetailId, nextValue);
    },
    [onAnswerChange, question.checklistDetailId],
  );

  return (
    <article className="my-checklists-question">
      <div className="my-checklists-question-header">
        <div className="my-checklists-question-label">
          <span>{question.text}</span>
          {question.isRequired ? (
            <span className="my-checklists-required">*</span>
          ) : null}
        </div>
        <span className="my-checklists-answered-at">
          {formatQuestionMeta(question)}
        </span>
      </div>

      <ChecklistAnswerField
        answerType={question.answerType}
        disabled={!canEdit}
        hasError={hasError}
        onChange={handleAnswerChange}
        value={value}
      />
    </article>
  );
}
