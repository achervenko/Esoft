import { Copy, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  archiveChecklistTemplate,
  checklistAnswerTypeLabels,
  checklistTemplateStateLabels,
  getChecklistAdminErrorMessage,
  getChecklistTemplate,
  type ChecklistTemplateDetail,
} from "../../shared/api/checklists";
import {
  formatModuleCount,
  formatQuestionCount,
} from "../../shared/lib/formatters";
import { canManageChecklists } from "../../shared/lib/roles";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { Notice } from "../../shared/ui/Notice";
import "../ChecklistAdminPage/ChecklistAdminPage.css";
import "./ChecklistTemplateViewPage.css";

type ChecklistTemplateViewPageProps = {
  templateId: number;
  userRole: string | null;
};

export function ChecklistTemplateViewPage({
  templateId,
  userRole,
}: ChecklistTemplateViewPageProps) {
  const isAdmin = canManageChecklists(userRole);
  const [template, setTemplate] = useState<ChecklistTemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [message] = useState<string | null>(() =>
    window.history.state?.checklistTemplateSaved ? "Шаблон сохранён." : null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (window.history.state?.checklistTemplateSaved) {
      window.history.replaceState(
        { ...window.history.state, checklistTemplateSaved: false },
        "",
      );
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    setTemplate(null);

    getChecklistTemplate(templateId)
      .then((response) => {
        if (!isCancelled) {
          setTemplate(response.template);
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
          setTemplate(null);
          setError(getChecklistAdminErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isAdmin, templateId]);

  const moduleCount = template?.modules.length ?? 0;
  const questionCount =
    template?.modules.reduce(
      (total, module) => total + module.questions.length,
      0,
    ) ?? 0;

  const deleteTemplate = async () => {
    if (!template || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await archiveChecklistTemplate(template.id, template.version);
      window.location.hash = "#/checklist-admin";
    } catch (requestError) {
      setDeleteError(getChecklistAdminErrorMessage(requestError));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="checklist-template-view-page">
        <Notice tone="error">Недостаточно прав для управления чек-листами.</Notice>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="checklist-template-view-page">
        <p className="admin-state">Загрузка...</p>
      </section>
    );
  }

  if (!template) {
    return (
      <section className="checklist-template-view-page">
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <Notice tone="error">Шаблон не найден.</Notice>
        )}
      </section>
    );
  }

  return (
    <section className="checklist-template-view-page">
      <header className="checklist-template-view-header">
        <button
          className="checklist-editor-back"
          onClick={() => {
            window.location.hash = "#/checklist-admin";
          }}
          type="button"
        >
          ← Назад
        </button>
        <div className="checklist-template-view-title-row">
          <div>
            <div className="checklist-template-view-title-main">
              <h1>{template.name}</h1>
              <span className={`checklist-admin-status ${template.state.toLowerCase()}`}>
                {checklistTemplateStateLabels[template.state]}
              </span>
            </div>
            {template.description ? (
              <p className="checklist-template-view-description">
                {template.description}
              </p>
            ) : null}
          </div>
          <div className="checklist-editor-actions">
            <button
              className="admin-secondary-button"
              onClick={() => {
                window.location.hash = `#/checklist-admin/templates/new?copyFrom=${template.id}`;
              }}
              type="button"
            >
              <Copy size={17} />
              Копировать
            </button>
            {template.state === "ACTIVE" ? (
              <button
                className="admin-secondary-button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                type="button"
              >
                <Trash2 size={17} />
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <main className="checklist-template-view-document">
        <div className="checklist-template-view-summary">
          <span>{formatModuleCount(moduleCount)}</span>
          <span>{formatQuestionCount(questionCount)}</span>
        </div>

        {template.modules.length === 0 ? (
          <p className="admin-state">В шаблоне пока нет модулей.</p>
        ) : null}

        <div className="checklist-template-view-modules">
          {template.modules.map((module, moduleIndex) => (
            <section className="checklist-template-view-module" key={module.id}>
              <h2>
                {moduleIndex + 1}. {module.name}
              </h2>
              <ol>
                {module.questions.map((question, questionIndex) => (
                  <li key={question.id}>
                    <div className="checklist-template-view-question-title">
                      <span aria-hidden="true">{questionIndex + 1}.</span>
                      <span className="checklist-template-view-question-text">
                        {question.questionText}
                        {question.isRequired ? (
                          <b aria-label="Обязательный вопрос">*</b>
                        ) : null}
                      </span>
                    </div>
                    <small>
                      Тип ответа: {checklistAnswerTypeLabels[question.answerType]}
                    </small>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </main>

      {deleteOpen ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Удалить"
          description="Шаблон больше нельзя будет использовать для новых событий. Уже созданные события и чек-листы не изменятся."
          error={deleteError}
          isLoading={isDeleting}
          loadingLabel="Удаление..."
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void deleteTemplate()}
          title="Удалить шаблон?"
          variant="danger"
        />
      ) : null}
    </section>
  );
}
