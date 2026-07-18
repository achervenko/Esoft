import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistAdminErrorMessage,
  getChecklistTemplate,
  type ChecklistModule,
  type ChecklistQuestion,
  type ChecklistTemplateDetail,
} from "../../shared/api/checklists";
import {
  loadAllChecklistModules,
  loadAllChecklistQuestions,
} from "./checklist-template-editor.catalog";

type UseChecklistTemplateLoaderParams = {
  copyFromTemplateId?: number | null;
  isAdmin: boolean;
  templateId: number | null;
};

export function useChecklistTemplateLoader({
  copyFromTemplateId = null,
  isAdmin,
  templateId,
}: UseChecklistTemplateLoaderParams) {
  const [loadedTemplate, setLoadedTemplate] =
    useState<ChecklistTemplateDetail | null>(null);
  const [modules, setModules] = useState<ChecklistModule[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const resetLoaderState = useCallback(() => {
    setLoadedTemplate(null);
    setModules([]);
    setQuestions([]);
    setError(null);
  }, []);

  const loadData = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!isAdmin) {
      resetLoaderState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    resetLoaderState();

    try {
      const [modulesResponse, questionsResponse, templateResponse] =
        await Promise.all([
          loadAllChecklistModules({ isActive: true }),
          loadAllChecklistQuestions({ isActive: true }),
          templateId === null
            ? copyFromTemplateId === null
              ? Promise.resolve(null)
              : getChecklistTemplate(copyFromTemplateId)
            : getChecklistTemplate(templateId),
        ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      setLoadedTemplate(templateResponse?.template ?? null);
      setModules(modulesResponse);
      const activeModuleIds = new Set(
        modulesResponse.map((module) => module.id),
      );
      setQuestions(
        questionsResponse.filter((question) =>
          question.checklistModuleId !== null &&
          activeModuleIds.has(question.checklistModuleId),
        ),
      );
    } catch (requestError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(getChecklistAdminErrorMessage(requestError));
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [copyFromTemplateId, isAdmin, resetLoaderState, templateId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    error,
    isLoading,
    loadedTemplate,
    modules,
    questions,
  };
}
