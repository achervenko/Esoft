import type {
  ChecklistTemplateDetail,
  ChecklistTemplateQuestion,
} from "../../shared/api/checklists";
import { AdminModal } from "../../shared/ui/AdminModal";
import "./PreviewModal.css";

export function PreviewModal({
  onClose,
  template,
}: {
  onClose: () => void;
  template: ChecklistTemplateDetail;
}) {
  return (
    <AdminModal onClose={onClose} title="Предпросмотр шаблона">
      <div className="checklist-editor-preview">
        <h3>{template.name}</h3>
        {template.description ? (
          <p className="checklist-editor-preview-description">
            {template.description}
          </p>
        ) : null}
        {template.modules.length === 0 ? (
          <p className="admin-state">В шаблоне пока нет модулей.</p>
        ) : null}
        {template.modules.map((module) => (
          <section className="checklist-editor-template-module" key={module.id}>
            <h3>{module.name}</h3>
            {module.questions.map((question, questionIndex) => (
              <div className="checklist-editor-preview-question" key={question.id}>
                <div className="checklist-editor-preview-question-header">
                  <span>
                    {questionIndex + 1}. {question.questionText}
                    {question.isRequired ? (
                      <b aria-label="Обязательный вопрос">*</b>
                    ) : null}
                  </span>
                </div>
                {renderPreviewInput(question)}
              </div>
            ))}
          </section>
        ))}
      </div>
    </AdminModal>
  );
}

function renderPreviewInput(question: ChecklistTemplateQuestion) {
  const label = getPreviewInputLabel(question);

  if (question.answerType === "BOOLEAN") {
    return (
      <div className="checklist-editor-preview-radio-group">
        <label>
          <input
            aria-label={`${label}: Да`}
            disabled
            name={`preview-question-${question.id}`}
            type="radio"
          />
          Да
        </label>
        <label>
          <input
            aria-label={`${label}: Нет`}
            disabled
            name={`preview-question-${question.id}`}
            type="radio"
          />
          Нет
        </label>
      </div>
    );
  }

  if (question.answerType === "INTEGER") {
    return (
      <input
        aria-label={label}
        disabled
        inputMode="numeric"
        placeholder="0"
        type="number"
      />
    );
  }

  if (question.answerType === "DECIMAL") {
    return (
      <input
        aria-label={label}
        disabled
        inputMode="decimal"
        placeholder="0.0"
        type="number"
      />
    );
  }

  if (question.answerType === "DATE") {
    return <input aria-label={label} disabled type="date" />;
  }

  return <textarea aria-label={label} disabled placeholder="Текст ответа" />;
}

function getPreviewInputLabel(question: ChecklistTemplateQuestion) {
  return `Ответ на вопрос: ${question.questionText}`;
}
