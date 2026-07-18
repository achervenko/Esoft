import { useCallback } from "react";
import {
  createChecklistTemplate,
  getChecklistAdminErrorMessage,
  type ChecklistTemplateDetail,
} from "../../shared/api/checklists";
import { pushMarkedHashHistoryEntry } from "../../shared/lib/hash-history-marker";

type UseTemplatePersistenceParams = {
  isNewTemplate: boolean;
  isSaving: boolean;
  setError: (error: string | null) => void;
  setIsDirty: (isDirty: boolean) => void;
  setIsSaving: (isSaving: boolean) => void;
  setMessage: (message: string | null) => void;
  template: ChecklistTemplateDetail | null;
};

export function useTemplatePersistence({
  isNewTemplate,
  isSaving,
  setError,
  setIsDirty,
  setIsSaving,
  setMessage,
  template,
}: UseTemplatePersistenceParams) {
  const save = useCallback(async () => {
    if (!template || isSaving || !isNewTemplate) {
      return false;
    }

    const trimmedName = template.name.trim();

    if (!trimmedName) {
      setError("Укажите название шаблона.");
      return false;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await createChecklistTemplate({
        description: template.description,
        modules: template.modules.map((module, moduleIndex) => ({
          checklistModuleId: module.checklistModuleId,
          questions: module.questions.map((question, questionIndex) => ({
            checklistQuestionId: question.checklistQuestionId,
            isRequired: question.isRequired,
            sortOrder: questionIndex + 1,
          })),
          sortOrder: moduleIndex + 1,
        })),
        name: trimmedName,
      });

      setIsDirty(false);
      pushMarkedHashHistoryEntry(
        { checklistTemplateSaved: true },
        `#/checklist-admin/templates/${response.template.id}`,
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return true;
    } catch (requestError) {
      setError(getChecklistAdminErrorMessage(requestError));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    isNewTemplate,
    isSaving,
    setError,
    setIsDirty,
    setIsSaving,
    setMessage,
    template,
  ]);

  const exitEditor = useCallback(
    async (href = "#/checklist-admin") => {
      setIsDirty(false);
      window.location.hash = href;
      return true;
    },
    [setIsDirty],
  );

  const copy = useCallback(async () => {
    if (!template) {
      return false;
    }

    window.location.hash = `#/checklist-admin/templates/new?copyFrom=${template.id}`;
    return true;
  }, [template]);

  return {
    copy,
    exitEditor,
    save,
  };
}
