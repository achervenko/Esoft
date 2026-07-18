import { useCallback, useRef, useState } from "react";
import type { ChecklistTemplateDetail } from "../../shared/api/checklists";
import { createLocalTemplate } from "./checklist-template-editor.factory";

type UseLocalTemplateStateParams = {
  isNewTemplate: boolean;
  isSaving: boolean;
  setError: (error: string | null) => void;
  setMessage: (message: string | null) => void;
};

export function useLocalTemplateState({
  isNewTemplate,
  isSaving,
  setError,
  setMessage,
}: UseLocalTemplateStateParams) {
  const [template, setTemplate] = useState<ChecklistTemplateDetail | null>(null);
  const [isDirty, setIsDirtyState] = useState(false);
  const isDirtyRef = useRef(false);
  const localIdRef = useRef(-1);
  const templateRef = useRef<ChecklistTemplateDetail | null>(null);

  const setIsDirty = useCallback((value: boolean) => {
    isDirtyRef.current = value;
    setIsDirtyState(value);
  }, []);

  const getNextLocalId = useCallback(() => localIdRef.current--, []);

  const setTemplateValue = useCallback((value: ChecklistTemplateDetail | null) => {
    templateRef.current = value;
    setTemplate(value);
  }, []);

  const setTemplateFromLoad = useCallback(
    (loadedTemplate: ChecklistTemplateDetail | null) => {
      if (isNewTemplate) {
        setTemplateValue(createLocalTemplate(loadedTemplate, getNextLocalId));
        setIsDirty(Boolean(loadedTemplate));
        return;
      }

      setTemplateValue(loadedTemplate);
      setIsDirty(false);
    },
    [getNextLocalId, isNewTemplate, setIsDirty, setTemplateValue],
  );

  const runLocalMutation = useCallback(
    async (
      action: (
        currentTemplate: ChecklistTemplateDetail,
      ) => ChecklistTemplateDetail,
    ) => {
      const currentTemplate = templateRef.current;

      if (!currentTemplate || !isNewTemplate || isSaving) {
        return false;
      }

      setError(null);
      setMessage(null);
      const nextTemplate = action(currentTemplate);

      if (nextTemplate !== currentTemplate) {
        setTemplateValue(nextTemplate);
        setIsDirty(true);
      }

      return true;
    },
    [isNewTemplate, isSaving, setError, setIsDirty, setMessage, setTemplateValue],
  );

  const shouldConfirmExit = useCallback(() => {
    return isNewTemplate && isDirtyRef.current;
  }, [isNewTemplate]);

  return {
    getNextLocalId,
    isDirty,
    runLocalMutation,
    setIsDirty,
    setTemplate: setTemplateValue,
    setTemplateFromLoad,
    shouldConfirmExit,
    template,
  };
}
