import { checklistAnswerTypeLabels } from "../../../shared/api/checklists";
import { ChecklistAnswerField } from "./ChecklistAnswerField";
import { formatDateTime } from "../my-checklists.utils";
import type { ChecklistQuestionProps } from "../my-checklists.types";

export function ChecklistQuestion({
  canEdit,
  onChange,
  question,
  value,
}: ChecklistQuestionProps) {
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
          {question.answeredAt
            ? `Ответ: ${formatDateTime(question.answeredAt)}`
            : checklistAnswerTypeLabels[question.answerType]}
        </span>
      </div>

      <ChecklistAnswerField
        answerType={question.answerType}
        disabled={!canEdit}
        onChange={onChange}
        value={value}
      />
    </article>
  );
}
